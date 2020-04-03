import * as FabricClient from 'fabric-client';
import { getChannelCheckpoint, storeChannelCheckpoint } from './checkpoint';
import { createModuleDebug } from './debug';
import {
    checkRequiredEnvVar,
    FABRIC_CERTFILE,
    FABRIC_KEYFILE,
    FABRIC_CLIENT_CERTFILE,
    FABRIC_CLIENT_KEYFILE,
    FABRIC_LOGGER_USERNAME,
    FABRIC_MSP,
    FABRIC_PEER,
    NETWORK_CONFIG,
} from './env';
import { logEvent } from './output';
import {
    decodeChainCodeAction,
    decodeChaincodeDeploymentSpec,
    decodeSignaturePolicyEnvolope,
    isSignaturePolicyEnvolope,
} from './protobuf';
import { isLikelyText, toText } from './convert';
import { get } from 'lodash';
import { promisify } from 'util';
import * as fs from 'fs';

const { debug, info, error } = createModuleDebug('fabric');
const readFile = promisify(fs.readFile);

let client: FabricClient;
const eventHubs: { [channelName: string]: FabricClient.ChannelEventHub } = {};

export async function initClient(): Promise<void> {
    if (NETWORK_CONFIG === 'mock') {
        debug('Skipping fabric client initializtion for mock mode');
        return;
    }

    info('Creating fabric client from network config', NETWORK_CONFIG);
    client = FabricClient.loadFromConfig(NETWORK_CONFIG);

    if (FABRIC_CLIENT_CERTFILE && FABRIC_CLIENT_KEYFILE) {
        const clientkey = await readFile(FABRIC_CLIENT_KEYFILE, { encoding: 'utf-8' });
        const clientcert = await readFile(FABRIC_CLIENT_CERTFILE, { encoding: 'utf-8' });
        client.setTlsClientCertAndKey(clientcert, clientkey);
    }

    info('Creating fabric user %o', FABRIC_LOGGER_USERNAME);
    client.createUser({
        username: FABRIC_LOGGER_USERNAME,
        mspid: FABRIC_MSP,
        cryptoContent: {
            privateKey: checkRequiredEnvVar(FABRIC_KEYFILE, 'FABRIC_KEYFILE'),
            signedCert: checkRequiredEnvVar(FABRIC_CERTFILE, 'FABRIC_CERTFILE'),
        },
        skipPersistence: true,
    });
}

export function getChannelType(data: FabricClient.BlockData): string {
    return data.payload.header.channel_header.typeString.toLowerCase();
}

export function getChannelId(data: FabricClient.BlockData): string {
    return data.payload.header.channel_header.channel_id;
}

export const handleBlockError = (channelName: string) => (e: Error) => {
    error('Failed to receive the tx event for channel=%s ::', channelName, e);
};

export const handleChaincodeEventError = (channelName: string) => (e: Error) => {
    error('Failed to receive the chaincode event for channel=%s ::', channelName, e);
};

const isFilteredBlock = (block: FabricClient.Block | FabricClient.FilteredBlock): block is FabricClient.FilteredBlock =>
    'filtered_transactions' in block;

export function processFilteredBlock(block: FabricClient.FilteredBlock) {
    error('Received unexpected filtered block', block);
}

export function parseMessageHeaderExtension(msg: FabricClient.BlockData): void {
    const { header } = msg.payload;
    const { type, extension } = header.channel_header || { type: undefined, extension: undefined };
    if (extension instanceof Buffer) {
        if (type === 3) {
            try {
                const chainCodeAction = decodeChainCodeAction(extension);
                header.channel_header.extension = chainCodeAction;
            } catch (e) {
                debug('Failed to decode chain code action from ENDORSER_TRANSACTION header extension', e);
            }
        } else if (isLikelyText(extension)) {
            header.channel_header.extension = toText(extension);
        }
    }
}

export function parseChaincodeSpecInput(msg: FabricClient.BlockData): void {
    const actions = msg.payload.data.actions;
    if (Array.isArray(actions)) {
        for (const action of actions) {
            const chaincodeInput = get(action, 'payload.chaincode_proposal_payload.input.chaincode_spec.input');
            if (chaincodeInput && Array.isArray(chaincodeInput.args)) {
                const inputArgs: Buffer[] = chaincodeInput.args;
                const firstArg = toText(inputArgs[0]);
                if (firstArg === 'deploy') {
                    const [, second, cds, spe, ...rest] = inputArgs;
                    const args: any[] = [firstArg, toText(second)];
                    try {
                        args[2] = decodeChaincodeDeploymentSpec(cds);
                    } catch (e) {
                        if (isSignaturePolicyEnvolope(cds)) {
                            args[2] = decodeSignaturePolicyEnvolope(cds);
                        } else {
                            args[2] = isLikelyText(cds) ? toText(cds) : cds;
                        }
                    }
                    try {
                        args[3] = decodeSignaturePolicyEnvolope(spe);
                    } catch (e) {
                        args[3] = isLikelyText(spe) ? toText(spe) : spe;
                    }
                    chaincodeInput.args = [...args, rest.map((buf: Buffer) => (isLikelyText(buf) ? toText(buf) : buf))];
                } else {
                    chaincodeInput.args = chaincodeInput.args.map((buf: Buffer) =>
                        isLikelyText(buf) ? toText(buf) : buf
                    );
                }
            }
        }
    }
}

export function getMessageTimestamp(msg: FabricClient.BlockData): string | undefined {
    return get(msg, 'payload.header.channel_header.timestamp');
}

export const processBlock = (channelName: string, initCheckpoint: number) => (
    block: FabricClient.Block | FabricClient.FilteredBlock
) => {
    if (isFilteredBlock(block)) {
        return processFilteredBlock(block);
    }

    const blockNumber = +block.header.number;
    if (blockNumber <= initCheckpoint) {
        debug(`Ignoring block number=%d on channel=%d since we already processed it`, blockNumber, channelName);
        return;
    }
    debug('Processing block number=%d on channel=%s', blockNumber, channelName);

    for (const msg of block.data.data) {
        if ('payload' in msg) {
            parseMessageHeaderExtension(msg);
            parseChaincodeSpecInput(msg);
            logEvent(
                {
                    block_number: blockNumber,
                    ...msg,
                },
                getChannelType(msg),
                getMessageTimestamp(msg)
            );
        } else {
            debug(`Ignoring message without payload: %O`, msg);
        }
    }

    debug('Processed all transactions for block number=%d on channel=%s', blockNumber, channelName);

    logEvent(block, 'block');
    storeChannelCheckpoint(channelName, +block.header.number);

    info('Completed processing block number=%d on channel=%s', blockNumber, channelName);
};

export async function registerListener(channelName: string): Promise<void> {
    if (client == null) {
        throw new Error('Fabric client not initialized');
    }
    const channel: FabricClient.Channel = client.getChannel(channelName);

    let channelEventHub: FabricClient.ChannelEventHub;
    try {
        info('Creating new event hub for channel=%s', channelName);
        channelEventHub = channel.newChannelEventHub(FABRIC_PEER);
    } catch (err) {
        if (err.message == `Peer with name "${FABRIC_PEER}" not assigned to this channel`) {
            info('Assigning fabric peer=%s to channel=%s', FABRIC_PEER, channelName);
            channel.addPeer(client.getPeer(FABRIC_PEER), FABRIC_MSP);
            channelEventHub = channel.newChannelEventHub(FABRIC_PEER);
        } else {
            error('Failed to create channel event hub for channel=%s', channelName, err);
            throw err;
        }
    }

    eventHubs[channelName] = channelEventHub;

    const latestCheckpoint = getChannelCheckpoint(channelName, 0);
    info('Subscribing to block events on channel=%s from block number=%d', channelName, latestCheckpoint);
    channelEventHub.registerBlockEvent(processBlock(channelName, latestCheckpoint), handleBlockError(channelName), {
        startBlock: latestCheckpoint || 1,
    });

    return new Promise((resolve, reject) => {
        channelEventHub.connect({ full_block: true }, err => {
            if (err != null) {
                error('Failed to connect channel event hub', err);
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

export const processChaincodeEvent = (channelName: string) => (
    event: FabricClient.ChaincodeEvent,
    blockNumber: number | undefined,
    txid: string | undefined,
    txstatus: string | undefined
) => {
    info('Processing chaincode event');
    logEvent(
        {
            block_number: blockNumber,
            channel: channelName,
            transaction_id: txid,
            transaction_status: txstatus,
            event: event,
            payload_message: event.payload.toString(),
        },
        'ccevent'
    );
    info(
        'Completed processing chaincode event on block=%s transaction_id=%s transaction_status=%s',
        blockNumber,
        txid,
        txstatus
    );
};

export async function registerChaincodeEvent(
    channelName: string,
    chaincodeId: string,
    filter: string
): Promise<void> {
    if (client == null) {
        throw new Error('Fabric client not initialized');
    }
    const channel: FabricClient.Channel = client.getChannel(channelName);
    let channelEventHub: FabricClient.ChannelEventHub;
    try {
        info('Creating new event hub for channel=%s', channelName);
        channelEventHub = channel.newChannelEventHub(FABRIC_PEER);
    } catch (err) {
        if (err.message == `Peer with name "${FABRIC_PEER}" not assigned to this channel`) {
            info('Assigning fabric peer=%s to channel=%s', FABRIC_PEER, channelName);
            channel.addPeer(client.getPeer(FABRIC_PEER), FABRIC_MSP);
            channelEventHub = channel.newChannelEventHub(FABRIC_PEER);
        } else {
            error('Failed to create channel event hub for channel=%s', channelName, err);
            throw err;
        }
    }
    const name = `${channelName}_${chaincodeId}_${filter}`;
    eventHubs[name] = channelEventHub;

    channelEventHub.registerChaincodeEvent(
        chaincodeId,
        filter,
        processChaincodeEvent(channelName),
        handleChaincodeEventError(channelName)
    );

    return new Promise((resolve, reject) => {
        info('Connecting to eventhub');
        channelEventHub.connect(true, err => {
            if (err != null) {
                error('Failed to connect channel event hub', err);
                reject(err);
            } else {
                info('Connected to eventhub');
                resolve();
            }
        });
    });
}

export function removeListener(channelName: string) {
    const hub = eventHubs[channelName];
    if (hub != null) {
        hub.disconnect();
        delete eventHubs[channelName];
    }
}

export function hasListener(channelName: string): boolean {
    const hub = eventHubs[channelName];
    return hub != null && hub.isconnected();
}

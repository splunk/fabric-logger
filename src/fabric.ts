import * as FabricClient from 'fabric-client';
import { getChannelCheckpoint, storeChannelCheckpoint } from './checkpoint';
import { createModuleDebug } from './debug';
import {
    checkRequiredEnvVar,
    FABRIC_CERTFILE,
    FABRIC_KEYFILE,
    FABRIC_LOGGER_USERNAME,
    FABRIC_MSP,
    FABRIC_PEER,
    NETWORK_CONFIG,
} from './env';
import { logEvent } from './output';

const { debug, info, error } = createModuleDebug('fabric');

let client: FabricClient;
const eventHubs: { [channelName: string]: FabricClient.ChannelEventHub } = {};

export function initClient(): void {
    if (NETWORK_CONFIG === 'mock') {
        debug('Skipping fabric client initializtion for mock mode');
        return;
    }

    info('Creating fabric client from network config', NETWORK_CONFIG);
    client = FabricClient.loadFromConfig(NETWORK_CONFIG);

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

const isFilteredBlock = (block: FabricClient.Block | FabricClient.FilteredBlock): block is FabricClient.FilteredBlock =>
    'filtered_transactions' in block;

export function processFilteredBlock(block: FabricClient.FilteredBlock) {
    error('Received unexpected filtered block', block);
}

export const processBlock = (channelName: string) => (block: FabricClient.Block | FabricClient.FilteredBlock) => {
    if (isFilteredBlock(block)) {
        return processFilteredBlock(block);
    }

    for (const msg of block.data.data) {
        if ('payload' in msg) {
            logEvent(msg, getChannelType(msg));
        }
    }

    logEvent(block, 'block');
    storeChannelCheckpoint(channelName, +block.header.number);
};

export async function registerListener(channelName: string): Promise<void> {
    if (client == null) {
        throw new Error('Fabric client not initialized');
    }
    const channel: FabricClient.Channel = client.getChannel(channelName);

    let channelEventHub: FabricClient.ChannelEventHub;
    try {
        debug('Creating new event hub for channel', channelName);
        channelEventHub = channel.newChannelEventHub(FABRIC_PEER);
    } catch (err) {
        // NOTE: seems to be an error with certain network.yaml
        // See JIRA ticket here: https://jira.hyperledger.org/browse/FABN-1222
        if (err.message == `Peer with name "${FABRIC_PEER}" not assigned to this channel`) {
            debug('Assigning fabric peer %o to channel %o', FABRIC_PEER, channelName);
            channel.addPeer(client.getPeer(FABRIC_PEER), FABRIC_MSP);
            channelEventHub = channel.newChannelEventHub(FABRIC_PEER);
        } else {
            error('Failed to connect create channel event hub for channel %s', channelName, err);
            throw err;
        }
    }

    eventHubs[channelName] = channelEventHub;

    const latestCheckpoint = getChannelCheckpoint(channelName, 1);
    channelEventHub.registerBlockEvent(processBlock(channelName), handleBlockError(channelName), {
        startBlock: latestCheckpoint,
    });

    return new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/camelcase
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

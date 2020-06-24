import * as FabricClient from 'fabric-client';
import { Checkpoint } from './checkpoint';
import { createModuleDebug } from '@splunkdlt/debug-logging';
import { Output } from './output';
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
import { FabricConfigSchema } from './config';
import { ManagedResource } from '@splunkdlt/managed-resource';

const { debug, info, error } = createModuleDebug('fabric');
const readFile = promisify(fs.readFile);

export class FabricListener implements ManagedResource {
    private client: FabricClient | undefined;
    private eventHubs: { [channelName: string]: FabricClient.ChannelEventHub } = {};
    private checkpoint: Checkpoint;
    private config: FabricConfigSchema;
    private output: Output;

    constructor(checkpoint: Checkpoint, config: FabricConfigSchema, output: Output) {
        this.checkpoint = checkpoint;
        this.config = config;
        this.output = output;
    }

    public async shutdown() {
        for (const eventHub in this.eventHubs) {
            this.eventHubs[eventHub].close();
        }
    }

    public async initClient(): Promise<FabricClient.User | void> {
        if (this.config.networkConfig === 'mock') {
            debug('Skipping fabric client initializtion for mock mode');
            return;
        }

        info('Creating fabric client from network config', this.config.networkConfig);
        this.client = FabricClient.loadFromConfig(this.config.networkConfig);

        if (this.config.clientCertFile && this.config.clientKeyFile) {
            const clientkey = await readFile(this.config.clientKeyFile, { encoding: 'utf-8' });
            const clientcert = await readFile(this.config.clientCertFile, { encoding: 'utf-8' });
            this.client.setTlsClientCertAndKey(clientcert, clientkey);
        }

        info('Creating fabric user %o', this.config.user);
        return this.client.createUser({
            username: this.config.user,
            mspid: this.config.msp,
            cryptoContent: {
                privateKey: this.config.keyFile,
                signedCert: this.config.certFile,
            },
            skipPersistence: true,
        });
    }

    public async listen() {
        for (const channel of this.checkpoint.getAllChannelsWithCheckpoints()) {
            info('Resuming listener for channel=%s', channel);
            await this.registerListener(channel);
        }
        for (const cceventName of this.checkpoint.getAllChaincodeEventCheckpoints()) {
            info('Resuming listener for chaincode=%s', cceventName);
            await this.registerChaincodeEvent(cceventName.channelName, cceventName.chaincodeId, cceventName.filter);
        }
    }

    private getChannelType(data: FabricClient.BlockData): string {
        switch (data.payload.header.channel_header.typeString.toLowerCase()) {
            case 'endorser_transaction':
                return 'endorserTransaction';
        }
        return data.payload.header.channel_header.typeString.toLowerCase();
    }

    private getChannelId(data: FabricClient.BlockData): string {
        return data.payload.header.channel_header.channel_id;
    }

    private handleBlockError = (channelName: string) => (e: Error) => {
        //TODO Recconect if this is not from managed resource shutdown
        info('Eventhub for blocks on channel=%s shutting down ::', channelName, e.message);
    };

    private handleChaincodeEventError = (channelName: string) => (e: Error) => {
        //TODO Recconect if this is not from managed resource shutdown
        info('Eventhub for chaincode events on channel=%s shutting down ::', channelName, e.message);
    };

    isFilteredBlock = (block: FabricClient.Block | FabricClient.FilteredBlock): block is FabricClient.FilteredBlock =>
        'filtered_transactions' in block;

    private processFilteredBlock(block: FabricClient.FilteredBlock) {
        error('Received unexpected filtered block', block);
    }

    private parseMessageHeaderExtension(msg: FabricClient.BlockData): void {
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

    private parseChaincodeSpecInput(msg: FabricClient.BlockData): void {
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
                        chaincodeInput.args = [
                            ...args,
                            rest.map((buf: Buffer) => (isLikelyText(buf) ? toText(buf) : buf)),
                        ];
                    } else {
                        chaincodeInput.args = chaincodeInput.args.map((buf: Buffer) =>
                            isLikelyText(buf) ? toText(buf) : buf
                        );
                    }
                }
            }
        }
    }

    private getMessageTimestamp(msg: FabricClient.BlockData): Date {
        return new Date(get(msg, 'payload.header.channel_header.timestamp'));
    }

    private processBlock = (channelName: string, initCheckpoint: number) => (
        block: FabricClient.Block | FabricClient.FilteredBlock
    ) => {
        if (this.isFilteredBlock(block)) {
            return this.processFilteredBlock(block);
        }

        const blockNumber = +block.header.number;
        if (blockNumber <= initCheckpoint) {
            debug(`Ignoring block number=%d on channel=%d since we already processed it`, blockNumber, channelName);
            return;
        }
        debug('Processing block number=%d on channel=%s', blockNumber, channelName);

        for (const msg of block.data.data) {
            if ('payload' in msg) {
                this.parseMessageHeaderExtension(msg);
                this.parseChaincodeSpecInput(msg);
                this.output.logEvent(
                    {
                        type: this.getChannelType(msg),
                        block_number: blockNumber,
                        ...msg,
                    },
                    this.getMessageTimestamp(msg),
                    this.config.peer
                );
            } else {
                debug(`Ignoring message without payload: %O`, msg);
            }
        }

        debug('Processed all transactions for block number=%d on channel=%s', blockNumber, channelName);

        this.output.logEvent(
            { type: 'block', ...block },
            this.getMessageTimestamp(block.data.data[0]),
            this.config.peer
        );
        this.checkpoint.storeChannelCheckpoint(channelName, +block.header.number);

        info('Completed processing block number=%d on channel=%s', blockNumber, channelName);
    };

    public async registerListener(channelName: string): Promise<void> {
        if (this.client == null) {
            throw new Error('Fabric client not initialized');
        }
        const channel: FabricClient.Channel = this.client.getChannel(channelName);

        let channelEventHub: FabricClient.ChannelEventHub;
        try {
            info('Creating new event hub for channel=%s', channelName);
            channelEventHub = channel.newChannelEventHub(this.config.peer);
        } catch (err) {
            if (err.message == `Peer with name "${this.config.peer}" not assigned to this channel`) {
                info('Assigning fabric peer=%s to channel=%s', this.config.peer, channelName);
                channel.addPeer(this.client.getPeer(this.config.peer), this.config.msp);
                channelEventHub = channel.newChannelEventHub(this.config.peer);
            } else {
                error('Failed to create channel event hub for channel=%s', channelName, err);
                throw err;
            }
        }

        this.eventHubs[channelName] = channelEventHub;

        const latestCheckpoint = this.checkpoint.getChannelCheckpoint(channelName);
        info('Subscribing to block events on channel=%s from block number=%d', channelName, latestCheckpoint);
        channelEventHub.registerBlockEvent(
            this.processBlock(channelName, latestCheckpoint),
            this.handleBlockError(channelName),
            {
                startBlock: latestCheckpoint,
            }
        );

        return new Promise((resolve, reject) => {
            channelEventHub.connect({ full_block: true }, (err) => {
                if (err != null) {
                    error('Failed to connect channel event hub', err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    private processChaincodeEvent = (channelName: string, name: string, filter: string, chaincodeId: string) => (
        event: FabricClient.ChaincodeEvent,
        blockNumber: number | undefined,
        txid: string | undefined,
        txstatus: string | undefined
    ) => {
        info('Processing chaincode event');
        this.output.logEvent(
            {
                type: 'ccevent',
                block_number: blockNumber,
                channel: channelName,
                transaction_id: txid,
                transaction_status: txstatus,
                event: event,
                payload_message: event.payload.toString(),
            },
            undefined, // TODO Get timestamp from block transaction
            this.config.peer
        );
        if (blockNumber != undefined) {
            this.checkpoint.storeChaincodeEventCheckpoint(name, channelName, filter, chaincodeId, +blockNumber);
        }
        info(
            'Completed processing chaincode event on block=%s transaction_id=%s transaction_status=%s',
            blockNumber,
            txid,
            txstatus
        );
    };

    public async registerChaincodeEvent(channelName: string, chaincodeId: string, filter: string): Promise<void> {
        if (this.client == null) {
            throw new Error('Fabric client not initialized');
        }
        const channel: FabricClient.Channel = this.client.getChannel(channelName);
        let channelEventHub: FabricClient.ChannelEventHub;
        try {
            info('Creating new event hub for channel=%s', channelName);
            channelEventHub = channel.newChannelEventHub(this.config.peer);
        } catch (err) {
            if (err.message == `Peer with name "${this.config.peer}" not assigned to this channel`) {
                info('Assigning fabric peer=%s to channel=%s', this.config.peer, channelName);
                channel.addPeer(this.client.getPeer(this.config.peer), this.config.msp);
                channelEventHub = channel.newChannelEventHub(this.config.peer);
            } else {
                error('Failed to create channel event hub for channel=%s', channelName, err);
                throw err;
            }
        }
        const name = `${channelName}_${chaincodeId}_${filter}`;
        this.eventHubs[name] = channelEventHub;

        const latestCheckpoint = this.checkpoint.getChannelCheckpoint(name);
        channelEventHub.registerChaincodeEvent(
            chaincodeId,
            filter,
            this.processChaincodeEvent(channelName, name, filter, chaincodeId),
            this.handleChaincodeEventError(channelName),
            {
                startBlock: latestCheckpoint,
            }
        );

        return new Promise((resolve, reject) => {
            info('Connecting to eventhub');
            channelEventHub.connect(true, (err) => {
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

    public removeListener(channelName: string) {
        const hub = this.eventHubs[channelName];
        if (hub != null) {
            hub.disconnect();
            delete this.eventHubs[channelName];
        }
    }

    public hasListener(channelName: string): boolean {
        const hub = this.eventHubs[channelName];
        return hub != null && hub.isconnected();
    }
}

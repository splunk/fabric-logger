import { Checkpoint, CCEvent } from './checkpoint';
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
import { FabricConfigSchema } from './config';
import { ManagedResource } from '@splunkdlt/managed-resource';
import { retry, exponentialBackoff, RetryOptions } from '@splunkdlt/async-tasks';
import { readFile } from 'fs-extra';
import {
    Gateway,
    BlockListener,
    BlockEvent,
    ContractEvent,
    ContractListener,
    Wallets,
    GatewayOptions,
    X509Identity,
} from 'fabric-network';
import { BlockData } from 'fabric-common';
import { safeLoad } from 'js-yaml';

const { debug, info, warn } = createModuleDebug('fabric');

export class FabricListener implements ManagedResource {
    private gateway: Gateway;

    private listeners: { [channelName: string]: BlockListener } = {};
    private ccListeners: { [name: string]: ContractListener } = {};
    private checkpoint: Checkpoint;
    private config: FabricConfigSchema;
    private output: Output;

    constructor(checkpoint: Checkpoint, config: FabricConfigSchema, output: Output) {
        this.gateway = new Gateway();
        this.checkpoint = checkpoint;
        this.config = config;
        this.output = output;
    }

    public async shutdown(): Promise<void> {
        for (const [channel, listener] of Object.entries(this.listeners)) {
            const network = await this.gateway.getNetwork(channel);
            network.removeBlockListener(listener);
        }
    }

    public async initClient(): Promise<void> {
        if (this.config.networkConfig === 'mock') {
            debug('Skipping fabric client initialization for mock mode');
            return;
        }

        info('Creating fabric client from network config', this.config.networkConfig);
        const connectionProfileYaml = await readFile(this.config.networkConfig, { encoding: 'utf-8' });
        const connectionProfile = safeLoad(connectionProfileYaml);
        const wallet = await Wallets.newInMemoryWallet();

        const cert = await readFile(this.config.certFile, { encoding: 'utf-8' });
        const key = await readFile(this.config.keyFile, { encoding: 'utf-8' });
        const identity: X509Identity = {
            credentials: {
                certificate: cert,
                privateKey: key,
            },
            mspId: this.config.msp,
            type: 'X.509',
        };

        wallet.put(this.config.user, identity);

        const gatewayOptions: GatewayOptions = {
            identity: identity,
            wallet,
            discovery: { enabled: this.config.discovery, asLocalhost: this.config.asLocalHost },
        };

        if (this.config.clientCertFile && this.config.clientKeyFile) {
            const clientKey = await readFile(this.config.clientKeyFile, { encoding: 'utf-8' });
            const clientCert = await readFile(this.config.clientCertFile, { encoding: 'utf-8' });
            gatewayOptions.tlsInfo = {
                certificate: clientCert,
                key: clientKey,
            };
        }

        await this.gateway.connect(connectionProfile, gatewayOptions);
        info('Finished Connecting to gateway');
    }

    public async listen(options?: { listenerRetryOptions?: RetryOptions }): Promise<void> {
        info('Starting to listen on channels');
        const listenerRetryOptions = options?.listenerRetryOptions ?? {
            attempts: 30,
            waitBetween: exponentialBackoff({ min: 10, max: 5000 }),
        };
        for (const channel of this.checkpoint.getAllChannelsWithCheckpoints()) {
            info('Resuming listener for channel=%s', channel);
            const listener = await retry(() => this.registerListener(channel), listenerRetryOptions);
            this.listeners[channel] = listener;
        }
        for (const ccEvent of this.checkpoint.getAllChaincodeEventCheckpoints()) {
            info(
                'Resuming listener for chaincode=%s on channel=%s at block=%d',
                ccEvent.chaincodeId,
                ccEvent.channelName,
                ccEvent.block
            );
            const ccListener = await retry(() => this.registerChaincodeEvent(ccEvent), listenerRetryOptions);
            this.ccListeners[`${ccEvent.channelName}_${ccEvent.chaincodeId}`] = ccListener;
        }
        if (this.config.channels) {
            for (const channel of this.config.channels) {
                if (!this.hasListener(channel)) {
                    info('Registering listener for channel=%s', channel);
                    const listener = await retry(() => this.registerListener(channel), listenerRetryOptions);
                    this.listeners[channel] = listener;
                }
            }
        }
        if (this.config.ccevents) {
            for (const ccEvent of this.config.ccevents) {
                if (!this.hasCCListener(`${ccEvent.channelName}_${ccEvent.chaincodeId}`)) {
                    info(
                        'Registering listener for chaincode events channel=%s chaincodeId=%s',
                        ccEvent.channelName,
                        ccEvent.chaincodeId
                    );
                    const ccListener = await retry(() => this.registerChaincodeEvent(ccEvent), listenerRetryOptions);
                    this.ccListeners[`${ccEvent.channelName}_${ccEvent.chaincodeId}`] = ccListener;
                }
            }
        }
        if (Object.keys(this.config.channels).length === 0 && Object.keys(this.config.ccevents).length === 0) {
            warn(
                'No Channels or events are configured for listening.  Please update your fabriclogger.yaml config file to include channels or chaincode events to listen on.'
            );
        }
    }

    private getChannelType(data: BlockData): string {
        return data.payload.header.channel_header.typeString.toLowerCase();
    }

    private getChannelId(data: BlockData): string {
        return data.payload.header.channel_header.channel_id;
    }

    private getExtraBlockData(id: string, data: any): any {
        if (Array.isArray(data)) {
            for (const txn of data) {
                if (txn.payload.header.channel_header.tx_id === id) {
                    return txn;
                }
            }
        }
        return undefined;
    }

    private parseMessageHeaderExtension(msg: BlockData): void {
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

    private parseChaincodeSpecInput(msg: BlockData): void {
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

    private getMessageTimestamp(msg: BlockData): Date {
        return new Date(get(msg, 'payload.header.channel_header.timestamp'));
    }

    private processBlock: BlockListener = async (event) => {
        debug('Got block number %d block data %s', event.blockNumber, JSON.stringify(event.blockData));
        const block = event.blockData as any;
        if (block && block.data && block.data.data) {
            const channelName = String(this.getChannelId(block.data.data[0]));
            const initCheckpoint = this.checkpoint.getChannelCheckpoint(channelName);
            const blockNumber = Number(event.blockNumber);
            if (blockNumber <= initCheckpoint) {
                info(`Ignoring block_number=%d on channel=%d since we already processed it`, blockNumber, channelName);
                return Promise.resolve();
            }
            info('Processing block_number=%d on channel=%s', blockNumber, channelName);
            const transactions = event.getTransactionEvents();
            for (const transaction of transactions) {
                info(`Processing TransactionId=%s`, transaction.transactionId);
                const extraBlockData = this.getExtraBlockData(transaction.transactionId, block.data.data);
                this.output.logEvent(
                    {
                        type: this.getChannelType(extraBlockData),
                        block_number: blockNumber,
                        channel: channelName,
                        channel_header: extraBlockData.payload.header.channel_header,
                        ...transaction,
                    },
                    this.getMessageTimestamp(block.data.data[0])
                );
                info(`Finished Processing TransactionId=$s`, transaction.transactionId);
            }
            for (const msg of block.data.data) {
                if ('payload' in msg && this.getChannelType(msg) != 'endorser_transaction') {
                    this.parseMessageHeaderExtension(msg);
                    this.parseChaincodeSpecInput(msg);
                    this.output.logEvent(
                        {
                            type: this.getChannelType(msg),
                            block_number: blockNumber,
                            ...msg,
                        },
                        this.getMessageTimestamp(msg)
                    );
                } else {
                    debug(`Ignoring message without payload: %O`, msg);
                }
            }
            info('Processed all transactions for block_number=%d on channel=%s', blockNumber, channelName);

            this.output.logEvent(
                { type: 'block', block_number: blockNumber, ...block },
                this.getMessageTimestamp(block.data.data[0])
            );
            this.checkpoint.storeChannelCheckpoint(channelName, +blockNumber);
            info('Completed processing block_number=%d on channel=%s', blockNumber, channelName);
        }
        return Promise.resolve();
    };

    public async registerListener(channelName: string): Promise<BlockListener> {
        const network = await this.gateway.getNetwork(channelName);
        const latestCheckpoint = this.checkpoint.getChannelCheckpoint(channelName);
        info('Subscribing to block events on channel=%s from block_number=%d', channelName, latestCheckpoint);
        return network.addBlockListener(this.processBlock, {
            startBlock: latestCheckpoint,
            type: this.config.blockType,
        });
    }

    private processChaincodeEvent: ContractListener = async (event: ContractEvent) => {
        info('Processing chaincode event=%s  on chaincode=%s', event.eventName, event.chaincodeId);
        const blockEvent: BlockEvent = event.getTransactionEvent().getBlockEvent();
        const blockNumber = Number(blockEvent.blockNumber);
        const blockData = blockEvent.blockData as any;
        const channelName = this.getChannelId(blockData.data.data[0]);
        const timeStamp = this.getMessageTimestamp(blockData.data.data[0]);
        this.output.logEvent(
            {
                type: 'ccevent',
                block_number: blockNumber,
                payload_message: event.payload?.toString(),
                channel: channelName,
                ...event,
            },
            timeStamp
        );

        this.checkpoint.storeChaincodeEventCheckpoint(channelName, event.chaincodeId, +blockNumber);

        info('Completed processing chaincode event=%s on block_number=%d', event.eventName, blockNumber);
    };

    public async registerChaincodeEvent(ccEvent: CCEvent): Promise<ContractListener> {
        const network = await this.gateway.getNetwork(ccEvent.channelName);
        const contract = await network.getContract(ccEvent.chaincodeId);
        const latestCheckpoint = ccEvent.block || 0;
        info(
            'Subscribing to chaincode events on channel=%s from block_number=%d',
            ccEvent.channelName,
            latestCheckpoint
        );
        return contract.addContractListener(this.processChaincodeEvent, { startBlock: latestCheckpoint });
    }

    public async removeListener(channelName: string): Promise<void> {
        const hub = this.listeners[channelName];
        if (hub != null) {
            const network = await this.gateway.getNetwork(channelName);
            network.removeBlockListener(hub);
            delete this.listeners[channelName];
        }
    }

    public hasListener(channelName: string): boolean {
        const hub = this.listeners[channelName];
        return hub != null;
    }

    public hasCCListener(name: string): boolean {
        const listener = this.ccListeners[name];
        return listener != null;
    }
}

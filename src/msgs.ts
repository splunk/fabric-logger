import { ContractEvent, TransactionEvent } from 'fabric-network';
import { BlockData } from 'fabric-common';
import { MultiMetrics } from '@splunkdlt/hec-client';

export interface BlockMessage {
    type: 'block';
}

export interface BlockIntegrityMessage {
    type: 'block_integrity';
    response_index: number;
    block_number: number;
    channel: string;
    block_header: any;
    block_hash?: string;
}

export interface ConfigMessage extends BlockData {
    type: 'config';
    block_number: number;
}

export interface ChaincodeEventMessage extends ContractEvent {
    type: 'ccevent';
    block_number: number | undefined;
    channel: string | undefined;
    payload_message: string | undefined;
}

export interface NodeMetricsMessage extends MultiMetrics {
    type: 'node_metrics';
}
export interface UnKnownMessage extends BlockData {
    type: string;
    block_number: number | undefined;
}

export interface TransactionEventMessage extends TransactionEvent {
    type: string;
    block_number: number;
    channel: string;
    channel_header: any;
}

import { ContractEvent, TransactionEvent } from 'fabric-network';
import { BlockData } from 'fabric-common';

export interface BlockMessage {
    type: 'block';
}

export interface ConfigMessage extends BlockData {
    type: 'config';
    block_number: number;
}

export interface EndorserTransactionMessage extends BlockData {
    type: 'endorserTransaction';
    block_number: number;
}

export interface ChaincodeEventMessage extends ContractEvent {
    type: 'ccevent';
    block_number: number | undefined;
    channel: string | undefined;
    payload_message: string | undefined;
}

export interface UnKnownMessage extends BlockData {
    type: string;
    block_number: number | undefined;
}

export interface TransactionEventMessage extends TransactionEvent {
    type: string;
}

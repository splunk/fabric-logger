import { Block, BlockData, ChaincodeEvent } from 'fabric-client';

export interface BlockMessage extends Block {
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

export interface ChaincodeEventMessage {
    type: 'ccevent';
    block_number: number | undefined;
    channel: string | undefined;
    transaction_id: string | undefined;
    transaction_status: string | undefined;
    event: ChaincodeEvent;
    payload_message: string | undefined;
}

export interface UnKnownMessage extends BlockData {
    type: string;
    block_number: number | undefined;
}

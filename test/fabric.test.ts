import { Checkpoint } from '../src/checkpoint';
import { FabricListener } from '../src/fabric';
import { debug } from 'debug';
import { loadFabricloggerConfig, CliFlags } from '../src/config';
import { TestOutput } from './testOutput';
import { ContractListener, BlockListener, BlockEvent, TransactionEvent } from 'fabric-network';
import Long = require('long');
import * as blockEvent from './fixtures/blockEvent.json';
import * as blockTransaction from './fixtures/blockTransaction.json';
import { Channel } from 'fabric-common';

beforeAll(() => {
    debug.log = () => {
        // ignore
    };
});

jest.mock('../src/checkpoint', () => ({
    Checkpoint: class {
        loadCheckpoints = () => Promise.resolve();
        writeCheckpoints = () => Promise.resolve();
        getChannelCheckpoint = () => 0;
        getChaincodeCheckpoint = () => 0;
        storeChannelCheckpoint = () => undefined;
        storeChaincodeEventCheckpoint = () => undefined;
        getAllChannelsWithCheckpoints = () => [];
        getAllChaincodeEventCheckpoints = () => [];
    },
}));

jest.mock('fabric-network', () => ({
    Gateway: class {
        public blockListeners = [];
        public contractListeners = [];
        connect = () => Promise.resolve();
        getNetwork = () =>
            Promise.resolve({
                getContract: async () =>
                    Promise.resolve({
                        addContractListener: (cl: ContractListener) => Promise.resolve(cl),
                    }),
                getChannel: () => ({} as Channel),
                addBlockListener: async (bl: BlockListener) => {
                    const testBlockEvent = {
                        ...blockEvent,
                        blockNumber: Long.ONE.add(3),
                        getTransactionEvents: () => [(blockTransaction as unknown) as TransactionEvent],
                    };
                    testBlockEvent.blockData.header.data_hash = Buffer.from(
                        testBlockEvent.blockData.header.data_hash
                    ) as any;
                    testBlockEvent.blockData.header.previous_hash = Buffer.from(
                        testBlockEvent.blockData.header.previous_hash
                    ) as any;
                    await bl((testBlockEvent as unknown) as BlockEvent);
                    return Promise.resolve(bl);
                },
            });
    },
    Wallets: class {
        public static newInMemoryWallet = () => Promise.resolve({ put: () => undefined });
    },
}));

test('fabric', async () => {
    const checkpoint = new Checkpoint('.foo');
    await checkpoint.loadCheckpoints();
    const output = new TestOutput();
    const config = await loadFabricloggerConfig({
        'config-file': './test/config/test.fabriclogger.yaml',
    } as CliFlags);
    const fabricListener = new FabricListener(checkpoint, config.fabric, config.integrity, output);
    await fabricListener.initClient();
    await fabricListener.listen({ listenerRetryOptions: { attempts: 1, waitBetween: 0 } });
    expect(fabricListener.hasListener('myChannel')).toBeTruthy();
    expect(fabricListener.hasCCListener('myChannel_myChaincodeId')).toBeTruthy();
    expect(output.messages).toMatchSnapshot();
});

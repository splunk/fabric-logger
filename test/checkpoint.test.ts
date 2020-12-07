import { Checkpoint } from '../src/checkpoint';
import { debug } from 'debug';

beforeAll(() => {
    debug.log = () => {
        // ignore
    };
});

jest.mock('fs-extra');

test('Checkpoint', async () => {
    const chkpt = new Checkpoint('.foo');
    expect(() => {
        chkpt.getAllChaincodeEventCheckpoints();
    }).toThrowError();

    expect(() => {
        chkpt.getAllChannelsWithCheckpoints();
    }).toThrowError();

    expect(() => {
        chkpt.getChaincodeCheckpoint('foo', 'bar');
    }).toThrowError();

    expect(() => {
        chkpt.getChannelCheckpoint('foo');
    }).toThrowError();

    expect(() => {
        chkpt.storeChaincodeEventCheckpoint('foo', 'bar', 1);
    }).toThrowError();

    expect(() => {
        chkpt.storeChannelCheckpoint('foo', 1);
    }).toThrowError();

    await chkpt.loadCheckpoints();
    expect(chkpt.getAllChaincodeEventCheckpoints()).toHaveLength(0);

    expect(chkpt.getAllChannelsWithCheckpoints()).toHaveLength(0);

    expect(chkpt.getChaincodeCheckpoint('foo', 'bar')).toBe(1);
    expect(chkpt.getChannelCheckpoint('foo')).toBe(1);

    expect(chkpt.getChaincodeCheckpoint('foo', 'bar', 2)).toBe(2);
    expect(chkpt.getChannelCheckpoint('foo', 2)).toBe(2);

    chkpt.storeChaincodeEventCheckpoint('foo', 'bar', 2);
    expect(chkpt.getChaincodeCheckpoint('foo', 'bar')).toMatchObject({
        block: 2,
        chaincodeId: 'bar',
        channelName: 'foo',
    });

    chkpt.storeChannelCheckpoint('foo', 3);
    expect(chkpt.getChannelCheckpoint('foo')).toBe(3);
});

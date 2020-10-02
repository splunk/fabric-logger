import { stringify, parse } from 'ini';
import { createModuleDebug } from '@splunkdlt/debug-logging';
import { readFile, writeFile, pathExists } from 'fs-extra';
import { ManagedResource } from '@splunkdlt/managed-resource';

const { debug, info, error } = createModuleDebug('checkpoint');

export type Checkpoints = { [key: string]: any };
export type CCEvent = {
    channelName: string;
    chaincodeId: string;
    block: number;
};

export class Checkpoint implements ManagedResource {
    private checkpointFile: string;
    private globalCheckpoints: Checkpoints | null;
    private lastSerialized: string | null = null;
    private latestWritePromise: Promise<void>;

    constructor(checkpointFile: string) {
        this.checkpointFile = checkpointFile;
        this.globalCheckpoints = null;
        this.lastSerialized = null;
        this.latestWritePromise = Promise.resolve();
    }

    public async shutdown(): Promise<void> {
        await this.writeCheckpoints();
    }

    public async loadCheckpoints(): Promise<Checkpoints> {
        if (await pathExists(this.checkpointFile)) {
            info('Loading checkpoints from file at %s', this.checkpointFile);
            const contents = await readFile(this.checkpointFile, { encoding: 'utf-8' });
            debug('Parsing checkpoint file contents', contents);
            this.globalCheckpoints = parse(contents);
            if (this.globalCheckpoints.ccevents == undefined) {
                this.globalCheckpoints.ccevents = {};
            }
            debug('Loaded checkpoints: %o', this.globalCheckpoints);
        } else {
            info('Checkpoints file does not exist, starting with empty checkpoints dictionary');
            this.globalCheckpoints = { };
        }
        return this.globalCheckpoints;
    }

    public async writeCheckpoints(checkpoints: Checkpoints | null = this.globalCheckpoints): Promise<void> {
        const contents = stringify(checkpoints);
        if (contents !== this.lastSerialized) {
            debug('Serialized checkpoint contents: %o', contents);
            await writeFile(this.checkpointFile, contents, { encoding: 'utf-8' });
            info('Checkpoints file updated');
            this.lastSerialized = contents;
        }
    }

    public scheduleWriteCheckpoints() {
        this.latestWritePromise = this.latestWritePromise.then(() =>
            this.writeCheckpoints().catch((e) => {
                error('Failed to write checkpoint file:', e);
            })
        );
    }

    public getChannelCheckpoint(channel: string, defaultValue: number = 1): number {
        if (this.globalCheckpoints == null) {
            throw new Error('Checkpoints not loaded');
        }
        const value = this.globalCheckpoints[channel];
        if (value == null) {
            return defaultValue;
        }
        return value;
    }

    public getChaincodeCheckpoint(channel: string, chaincodeId: string, defaultValue: number = 1): number {
        if (this.globalCheckpoints == null) {
            throw new Error('Checkpoints not loaded');
        }
        const value = this.globalCheckpoints.ccevents[`${channel}_${chaincodeId}`];
        if (value == null) {
            return defaultValue;
        }
        return value;
    }

    public storeChannelCheckpoint(channel: string, value: number): void {
        if (this.globalCheckpoints == null) {
            throw new Error('Checkpoints not loaded');
        }
        this.globalCheckpoints[channel] = value;
        this.scheduleWriteCheckpoints();
    }

    public storeChaincodeEventCheckpoint(channelName: string, chaincodeId: string, block: number): void {
        if (this.globalCheckpoints == null) {
            throw new Error('Checkpoints not loaded');
        }
        this.globalCheckpoints.ccevents[`${channelName}_${chaincodeId}`] = { block, channelName, chaincodeId };
        this.scheduleWriteCheckpoints();
    }

    public getAllChannelsWithCheckpoints(): string[] {
        if (this.globalCheckpoints == null) {
            throw new Error('Checkpoints not loaded');
        }
        const { ccevents, ...channels } = this.globalCheckpoints;
        return Object.keys(channels);
    }

    public getAllChaincodeEventCheckpoints(): CCEvent[] {
        if (this.globalCheckpoints == null) {
            throw new Error('Checkpoints not loaded');
        }
        return Object.values(this.globalCheckpoints.ccevents);
    }
}

import { stringify, parse } from 'ini';
import { createModuleDebug } from '@splunkdlt/debug-logging';
import { promisify } from 'util';
import * as fs from 'fs';
import { ManagedResource } from '@splunkdlt/managed-resource';

const { debug, info, error } = createModuleDebug('checkpoint');

const readFile = promisify(fs.readFile);
const exists = promisify(fs.exists);
const writeFile = promisify(fs.writeFile);

export type Checkpoints = { [key: string]: any };
export type ccEvent = {
    channelName: string;
    filter: string;
    chaincodeId: string;
    block: number;
};

let globalCheckpoints: Checkpoints | null = null;
let lastSerialized: string | null = null;
let latestWritePromise: Promise<void> = Promise.resolve();

export class Checkpoint implements ManagedResource {
    private checkpointFile: string;

    constructor(checkpointFile: string) {
        this.checkpointFile = checkpointFile;
    }

    public async shutdown() {
        await this.writeCheckpoints();
    }

    public async loadCheckpoints(): Promise<Checkpoints> {
        if (await exists(this.checkpointFile)) {
            info('Loading checkpoints from file at %s', this.checkpointFile);
            const contents = await readFile(this.checkpointFile, { encoding: 'utf-8' });
            debug('Parsing checkpoint file contents', contents);
            globalCheckpoints = parse(contents);
            if (globalCheckpoints.ccevents == undefined) {
                globalCheckpoints.ccevents = {};
            }
            debug('Loaded checkpoints: %o', globalCheckpoints);
        } else {
            info('Checkpoints file does not exist, starting with empty checkpoints dictionary');
            globalCheckpoints = { ccevents: {} };
        }
        return globalCheckpoints;
    }

    public async writeCheckpoints(checkpoints: Checkpoints | null = globalCheckpoints) {
        const contents = stringify(checkpoints);
        if (contents !== lastSerialized) {
            debug('Serialized checkpoint contents: %o', contents);
            await writeFile(this.checkpointFile, contents, { encoding: 'utf-8' });
            info('Checkpoints file updated');
            lastSerialized = contents;
        }
    }

    public scheduleWriteCheckpoints() {
        latestWritePromise = latestWritePromise.then(() =>
            this.writeCheckpoints().catch(e => {
                error(`Failed to write checkpoint file:`, e);
            })
        );
    }

    public getChannelCheckpoint(channel: string, defaultValue: number = 1): number {
        if (globalCheckpoints == null) {
            throw new Error('Checkpoints not loaded');
        }
        const value = globalCheckpoints[channel];
        if (value == null) {
            return defaultValue;
        }
        return value;
    }

    public getChaincodeCheckpoint(name: string, defaultValue: number = 1): number {
        if (globalCheckpoints == null) {
            throw new Error('Checkpoints not loaded');
        }
        const value = globalCheckpoints.ccevents[name];
        if (value == null) {
            return defaultValue;
        }
        return value;
    }

    public storeChannelCheckpoint(channel: string, value: number) {
        if (globalCheckpoints == null) {
            throw new Error('Checkpoints not loaded');
        }
        globalCheckpoints[channel] = value;
        this.scheduleWriteCheckpoints();
    }

    public storeChaincodeEventCheckpoint(
        name: string,
        channelName: string,
        filter: string,
        chaincodeId: string,
        block: number
    ) {
        if (globalCheckpoints == null) {
            throw new Error('Checkpoints not loaded');
        }
        globalCheckpoints.ccevents[name] = { channelName, filter, chaincodeId, block };
        this.scheduleWriteCheckpoints();
    }

    public getAllChannelsWithCheckpoints(): string[] {
        if (globalCheckpoints == null) {
            throw new Error('Checkpoints not loaded');
        }
        const { ccevents, ...channels } = globalCheckpoints;
        return Object.keys(channels);
    }

    public getAllChaincodeEventCheckpoints(): ccEvent[] {
        if (globalCheckpoints == null) {
            throw new Error('Checkpoints not loaded');
        }
        return Object.values(globalCheckpoints.ccevents);
    }
}

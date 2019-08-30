import { stringify, parse } from 'ini';
import { CHECKPOINTS_FILE } from './env';
import { createModuleDebug } from './debug';
import { promisify } from 'util';
import * as fs from 'fs';

const { debug, info, error } = createModuleDebug('checkpoint');

const readFile = promisify(fs.readFile);
const exists = promisify(fs.exists);
const writeFile = promisify(fs.writeFile);

export type Checkpoints = { [key: string]: any };

let globalCheckpoints: Checkpoints | null = null;
let lastSerialized: string | null = null;

export async function loadCheckpoints(checkpointFile: string = CHECKPOINTS_FILE): Promise<Checkpoints> {
    if (await exists(checkpointFile)) {
        info('Loading checkpoints from file at %s', checkpointFile);
        const contents = await readFile(checkpointFile, { encoding: 'utf-8' });
        debug('Parsing checkpoint file contents', contents);
        globalCheckpoints = parse(contents);
        debug('Loaded checkpoints: %o', globalCheckpoints);
    } else {
        info('Checkpoints file does not exist, starting with empty checkpoitns dictionary');
        globalCheckpoints = {};
    }
    return globalCheckpoints;
}

export async function writeCheckpoints(
    checkpointFile: string = CHECKPOINTS_FILE,
    checkpoints: Checkpoints | null = globalCheckpoints
) {
    const contents = stringify(checkpoints);
    if (contents !== lastSerialized) {
        debug('Serialized checkpoint contents: %o', contents);
        await writeFile(checkpointFile, contents, { encoding: 'utf-8' });
        info('Checkpoints file updated');
        lastSerialized = contents;
    }
}

let latestWritePromise: Promise<void> = Promise.resolve();

export function scheduleWriteCheckpoints() {
    latestWritePromise = latestWritePromise.then(() =>
        writeCheckpoints().catch(e => {
            error(`Failed to write checkpoint file:`, e);
        })
    );
}

export function getChannelCheckpoint(channel: string, defaultValue: number = 1): number {
    if (globalCheckpoints == null) {
        throw new Error('Checkpoints not loaded');
    }
    const value = globalCheckpoints[channel];
    if (value == null) {
        return defaultValue;
    }
    return value;
}

export function storeChannelCheckpoint(channel: string, value: number) {
    if (globalCheckpoints == null) {
        throw new Error('Checkpoints not loaded');
    }
    globalCheckpoints[channel] = value;
    scheduleWriteCheckpoints();
}

export function getAllChannelsWithCheckpoints(): string[] {
    if (globalCheckpoints == null) {
        throw new Error('Checkpoints not loaded');
    }
    return Object.keys(globalCheckpoints);
}

import { Logger as SplunkLogger, SendContext, SendContextMetadata } from 'splunk-logging';
import {
    LOGGING_LOCATION,
    SPLUNK_HEC_TOKEN,
    SPLUNK_HOST,
    SPLUNK_PORT,
    SPLUNK_HEC_URL,
    FABRIC_PEER,
    SOURCETYPE_PREFIX,
    SPLUNK_INDEX,
} from './env';
import { createModuleDebug } from './debug';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { convertBuffersToHex } from './convert';

const exists = promisify(fs.exists);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

const { debug, info, error } = createModuleDebug('output');

export interface Logger {
    send(event: SendContext): void;
}

let currentLogger: Logger;

let outputDirPromise: Promise<string> | null;

export async function createOutputDirectory(): Promise<string> {
    const tempDir = path.join(process.cwd(), 'temp');
    if (!(await exists(tempDir))) {
        debug('Creating temp dir', tempDir);
        await mkdir(tempDir);
    }
    const outputDir = path.join(tempDir, 'output');
    if (!(await exists(outputDir))) {
        debug('Creating output dir', outputDir);
        await mkdir(outputDir);
    }
    return outputDir;
}

export function ensureOutputDirectory(): Promise<string> {
    if (outputDirPromise == null) {
        outputDirPromise = createOutputDirectory();
    }
    return outputDirPromise;
}

const filenameSafe = (name: string): string => name.replace(/[^\w]+/g, '_');

const randSuffix = () => Math.floor(Math.random() * 0xfffffff).toString(36);

export async function writeEventToFile(event: SendContext) {
    const dir = await ensureOutputDirectory();
    const meta = event.metadata || {};
    const { sourcetype = 'unkown_sourcetype', time = Date.now() } = meta as any;
    const fileName = `event_${filenameSafe(sourcetype)}_${time}_${randSuffix()}.json`;
    debug(`Writing event to file`, fileName);
    await writeFile(path.join(dir, fileName), JSON.stringify(event, null, 2), { encoding: 'utf-8' });
}

export function initializeLogOutput() {
    switch (LOGGING_LOCATION) {
        case 'splunk':
            // Maintain Backwards compatibility with previous versions of fabric logger that used SPLUNK_HOST and PORT without specifying SSL
            // See https://github.com/splunk/fabric-logger/issues/32
            const url = SPLUNK_HEC_URL != null ? SPLUNK_HEC_URL : `https://${SPLUNK_HOST}:${SPLUNK_PORT}`;
            currentLogger = new SplunkLogger({ token: SPLUNK_HEC_TOKEN, url });
            (currentLogger as any).eventFormatter = (event: any): any => event;
            info(`Using Splunk HEC at ${url}`);
            break;

        case 'stdout':
            currentLogger = {
                send: event => {
                    // eslint-disable-next-line no-console
                    console.log(JSON.stringify(event));
                },
            };
            info('Sending output to STDOUT');
            break;
        case 'file':
            currentLogger = {
                send: event => {
                    writeEventToFile(event).catch(e => {
                        error(`Failed to write event to file`, e);
                    });
                },
            };
            info('Writing events to local files');
            break;
    }
}

export function normalizeTime(timeValue: string | number | null | undefined, now = Date.now, log = true): number {
    if (typeof timeValue === 'number') {
        return timeValue / 1000;
    }
    if (typeof timeValue === 'string') {
        if (timeValue != '' && timeValue.includes('T') && timeValue.endsWith('Z')) {
            const t = new Date(timeValue).getTime();
            if (!isNaN(t)) {
                return t / 1000;
            } else if (log) {
                info('Failed to parse time value %o', timeValue);
            }
        } else if (log) {
            info('Ignoring invalid time value %o', timeValue);
        }
    }
    return now() / 1000;
}

export function logEvent(event: any, sourcetype: string, timeField: string | number | null | undefined = null) {
    const message = convertBuffersToHex(event);
    currentLogger.send({
        message: JSON.stringify(message),
        metadata: {
            source: FABRIC_PEER,
            sourcetype: SOURCETYPE_PREFIX + sourcetype,
            index: SPLUNK_INDEX,
            time: normalizeTime(timeField),
        } as SendContextMetadata,
    });
    debug(
        `Posted message size=${message.length} sourcetype=${sourcetype} to Splunk index=${SPLUNK_INDEX} from peer=${FABRIC_PEER}.`
    );
}

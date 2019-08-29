import { Logger as SplunkLogger, SendContext, SendContextMetadata } from 'splunk-logging';
import {
    LOGGING_LOCATION,
    SPLUNK_HEC_TOKEN,
    SPLUNK_HOST,
    SPLUNK_PORT,
    FABRIC_PEER,
    SOURCETYPE_PREFIX,
    SPLUNK_INDEX,
} from './env';
import { createModuleDebug } from './debug';

const { debug, info } = createModuleDebug('output');

export interface Logger {
    send(event: SendContext): void;
}

let currentLogger: Logger;

export function initializeLogOutput() {
    switch (LOGGING_LOCATION) {
        case 'splunk':
            const url = 'https://' + SPLUNK_HOST + ':' + SPLUNK_PORT;
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
    }
}

const isPlainObject = (obj: any): obj is Object =>
    typeof obj === 'object' && Object.prototype.toString.call(obj) === '[object Object]';

export function convertBuffersToHex(obj: any): any {
    if (obj == null) {
        return obj;
    }
    if (obj instanceof Buffer) {
        return { hex: obj.toString('hex') };
    }
    if (Array.isArray(obj)) {
        return obj.map(convertBuffersToHex);
    } else if (isPlainObject(obj)) {
        const result: { [k: string]: any } = {};
        Object.keys(obj).forEach(k => {
            const v = obj[k];
            if (v instanceof Buffer) {
                result[`${k}_hex`] = v.toString('hex');
            } else {
                result[k] = convertBuffersToHex(v);
            }
        });
        return result;
    }
    return obj;
}

export function logEvent(event: any, sourcetype: string, timeField: string | number | null | undefined = null) {
    if (timeField == null) {
        timeField = Date.now();
    }
    currentLogger.send({
        message: convertBuffersToHex(event),
        metadata: {
            source: FABRIC_PEER,
            sourcetype: SOURCETYPE_PREFIX + sourcetype,
            index: SPLUNK_INDEX,
            time: timeField,
        } as SendContextMetadata,
    });

    debug(`Posted sourcetype=${sourcetype} to Splunk index=${SPLUNK_INDEX} from peer=${FABRIC_PEER}.`);
}

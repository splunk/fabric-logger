import { createModuleDebug } from './debug';

require('dotenv').config();

const { debug, info } = createModuleDebug('env');

function parseNumber(val: string | undefined): number | undefined {
    if (val == null) {
        return undefined;
    }
    const n = parseInt(val, 10);
    if (isNaN(n)) {
        return undefined;
    }
    return n;
}

/** The logging location, valid values are `splunk` or `stdout` (defaults to `splunk`) */
export const LOGGING_LOCATION: 'splunk' | 'stdout' | 'file' =
    process.env.LOGGING_LOCATION === 'stdout' ? 'stdout' : process.env.LOGGING_LOCATION === 'file' ? 'file' : 'splunk';
/** A file used to hold checkpoints for each channel watched. If running in docker, be sure to mount a volume so that the file is not lost between restarts */
export const CHECKPOINTS_FILE: string = process.env.CHECKPOINTS_FILE || '.checkpoints';
/** Splunk hostname */
export const SPLUNK_HOST: string = process.env.SPLUNK_HOST!;
/** Splunk HEC port */
export const SPLUNK_PORT: number = parseNumber(process.env.SPLUNK_PORT) || 8088;
/** If using `splunk` as the logging location, the HEC token value */
export const SPLUNK_HEC_TOKEN: string = process.env.SPLUNK_HEC_TOKEN!;
/** Splunk index to log to */
export const SPLUNK_INDEX: string = process.env.SPLUNK_INDEX || 'hyperledger_logs';
/** A prefix used for the sourcetype when writing to Splunk */
export const SOURCETYPE_PREFIX: string = process.env.SOURCETYPE_PREFIX || 'fabric_logger:';
/** The hostname of the peer to connect to */
export const FABRIC_PEER: string = process.env.FABRIC_PEER!;
/** The name of the MSP that the logging user is enrolled in */
export const FABRIC_MSP: string = process.env.FABRIC_MSP!;
/** A network configuration object, an example can be found [here](https://fabric-sdk-node.github.io/release-1.4/tutorial-network-config.html) */
export const NETWORK_CONFIG: string = process.env.NETWORK_CONFIG!;
/** The username the that the `FABRIC_KEYFILE` is enrolled under */
export const FABRIC_LOGGER_USERNAME: string = process.env.FABRIC_LOGGER_USERNAME!;
/** The private key file used to authenticate with the Fabric peer */
export const FABRIC_KEYFILE: string | undefined = process.env.FABRIC_KEYFILE;
/** The signed certificate returned from the Fabric CA */
export const FABRIC_CERTFILE: string | undefined = process.env.FABRIC_CERTFILE;
/** The client private key file used in mutual TLS to authenticate with the Fabric peer */
export const FABRIC_CLIENT_KEYFILE: string | undefined = process.env.FABRIC_CLIENT_KEYFILE;
/** The client certificate file used in mutual TLS to authenticate with the Fabric peer */
export const FABRIC_CLIENT_CERTFILE: string | undefined = process.env.FABRIC_CLIENT_CERTFILE;

export function checkRequiredEnvVar(val: string | undefined, variable: string): string {
    if (val == null) {
        throw new Error(`Missing required environment variable ${variable}`);
    }
    return val;
}

export function initializeEnvironment() {
    if (LOGGING_LOCATION === 'splunk') {
        checkRequiredEnvVar(SPLUNK_HOST, 'SPLUNK_HOST');
        checkRequiredEnvVar(SPLUNK_HEC_TOKEN, 'SPLUNK_HEC_TOKEN');
        if (SPLUNK_PORT % 1 !== 0 || SPLUNK_PORT < 1 || SPLUNK_PORT > 65535) {
            throw new Error(`Invalid SPLUNK_PORT value specified - needs to be a valid port number`);
        }
    }
    checkRequiredEnvVar(FABRIC_PEER, 'FABRIC_PEER');
    checkRequiredEnvVar(FABRIC_MSP, 'FABRIC_MSP');
    checkRequiredEnvVar(NETWORK_CONFIG, 'NETWORK_CONFIG');
    checkRequiredEnvVar(FABRIC_LOGGER_USERNAME, 'FABRIC_LOGGER_USERNAME');

    info('Successfully initialized enviroment');

    debug('Variable %o = %o', 'LOGGING_LOCATION', LOGGING_LOCATION);
    debug('Variable %o = %o', 'CHECKPOINTS_FILE', CHECKPOINTS_FILE);
    debug('Variable %o = %o', 'SPLUNK_HOST', SPLUNK_HOST);
    debug('Variable %o = %o', 'SPLUNK_PORT', SPLUNK_PORT);
    debug('Variable %o = %o', 'SPLUNK_HEC_TOKEN', SPLUNK_HEC_TOKEN);
    debug('Variable %o = %o', 'SPLUNK_INDEX', SPLUNK_INDEX);
    debug('Variable %o = %o', 'SOURCETYPE_PREFIX', SOURCETYPE_PREFIX);
    debug('Variable %o = %o', 'FABRIC_PEER', FABRIC_PEER);
    debug('Variable %o = %o', 'FABRIC_MSP', FABRIC_MSP);
    debug('Variable %o = %o', 'NETWORK_CONFIG', NETWORK_CONFIG);
    debug('Variable %o = %o', 'FABRIC_LOGGER_USERNAME', FABRIC_LOGGER_USERNAME);
    debug('Variable %o = %o', 'FABRIC_KEYFILE', FABRIC_KEYFILE);
    debug('Variable %o = %o', 'FABRIC_CERTFILE', FABRIC_CERTFILE);
    debug('Variable %o = %o', 'FABRIC_CLIENT_KEYFILE', FABRIC_CLIENT_KEYFILE);
    debug('Variable %o = %o', 'FABRIC_CLIENT_CERTFILE', FABRIC_CLIENT_CERTFILE);
}

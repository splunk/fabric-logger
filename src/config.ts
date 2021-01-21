import { IOptionFlag } from '@oclif/command/lib/flags';
import { readFile, pathExists } from 'fs-extra';
import { CLI_FLAGS } from './cliflags';
import { join } from 'path';
import { safeLoad } from 'js-yaml';
import { createModuleDebug } from '@splunkdlt/debug-logging';
import { durationStringToMs } from './utils/parse';
import { deepMerge, isEmpty, removeEmptyValues } from './utils/obj';
import { exponentialBackoff, linearBackoff, WaitTime } from '@splunkdlt/async-tasks';
import { CCEvent } from './checkpoint';
import { ScraperEndpoint, ScraperConfigDefaults } from './prometheus';
import { BlockType } from 'fabric-common';

const { debug, error } = createModuleDebug('config');

export class ConfigError extends Error {}

export interface FabricloggerConfigSchema {
    /** Checkpoint configuration - how fabriclogger keeps track of state between restarts */
    checkpoint: CheckpointConfigSchema;
    /** Fabric configuration */
    fabric: FabricConfigSchema;
    /** HTTP event collector */
    hec: HecClientsConfigSchema;
    /** Prometheus Scraper Configuration */
    prometheus: PrometheusConfigSchema;
    /**
     * In the output configuration you can specify where fabriclogger will send generated
     * events to. By default it will send all information to Splunk HEC,
     * but you can instead send it to console output or a file.
     */
    output: OutputConfigSchema;
}

// Resolved Configuration
export interface FabricloggerConfig {
    fabric: FabricConfigSchema;
    checkpoint: CheckpointConfigSchema;
    prometheus: PrometheusConfig;
    hec: {
        default: HecConfig;
        events?: OptionalHecConfig;
        metrics?: OptionalHecConfig;
        internal?: OptionalHecConfig;
    };
    output: OutputConfigSchema;
}

export interface FabricConfigSchema {
    /** The name of the MSP that the user is enrolled in */
    msp: string;
    /** Network configuration file */
    networkConfig: string;
    /** The username to use for fabric logger */
    user: string;
    /** The private key for the user */
    keyFile: string;
    /** The signed certificate from the fabric certificate authority */
    certFile: string;
    /** The client certificate file used when mutual TLS is enabled to authenticate with the peer */
    clientCertFile?: string;
    /** The client private key used when mutual TLS is enabled to authenticate with the peer */
    clientKeyFile?: string;
    /** Channels to listen to */
    channels: string[];
    /** Chaincode events to listen to*/
    ccevents: CCEventConfig[];
    /** Block Type full or private */
    blockType?: BlockType;
    /** Enable Discovery service */
    discovery: boolean;
    /** Convert discovered addresses to localhost for docker */
    asLocalHost: boolean;
}

export interface PrometheusConfigSchema extends PrometheusScraperConfigSchema {
    /** Enable prometheus endpoint discovery. */
    discovery?: boolean;
    /** A common prefix for all Prometheus metrics emitted to Splunk */
    namePrefix?: string;
    /** Default port to try for discovered peers (overrides port). */
    peerPort?: string;
    /** Default path to try for discovered peers (overrides path). */
    peerPath?: string;
    /** Default port to try for discovered orderers (overrides port). */
    ordererPort?: string;
    /** Default path to try for discovered orderers (overrides path). */
    ordererPath?: string;
    /** Prometheus endpoints to scrape */
    endpoints?: PrometheusEndpointConfigSchema[];
}

export interface PrometheusScraperConfigSchema {
    /** Time between scrapes of Prometheus endpoints. */
    scrapeInterval?: DurationConfig;
    /** URL path to use when scraping Prometheus metrics */
    path?: string;
    /** Protocol to use when scraping Prometheus metrics */
    protocol?: string;
    /** Port to use when scraping Prometheus metrics. */
    port?: string;
    /** Request timeout */
    timeout?: number;
    /** If not disabled, this will allow the prometheus server to respond with compressed body (gzip or deflate) */
    allowCompression?: boolean;
    /** If set to false, the scraper will not check the content type of the response from the server */
    validateContentType?: boolean;
    /** If set to false, the HTTP client will ignore certificate errors (eg. when using self-signed certs) */
    validateCertificate?: boolean;
    /** User-agent header sent to metrics endpoint */
    userAgent?: string;
}
export interface PrometheusConfig {
    /** Enable prometheus endpoint discovery. */
    discovery: boolean;
    /** Prometheus endpoints to scrape */
    endpoints: ScraperEndpoint[];
    /** Default options */
    defaultOptions: ScraperConfigDefaults;
    /** Default options for discovered peers (overrides defaultOptions) */
    defaultPeerOptions?: OptionalScraperConfigDefaults;
    /** Default options for discovered orderers (overrides defaultOptions) */
    defaultOrdererOptions?: OptionalScraperConfigDefaults;
}

export interface PrometheusEndpointConfigSchema extends PrometheusScraperConfigSchema {
    /** Full URL to scrape for Prometheus metrics */
    url: string;
}
export interface HecClientsConfigSchema {
    /**
     * Base settings that apply to all HEC clients. Overrides for events, metrics and
     * internal metrics will be layered on top of the defaults and allow for using
     * different HEC tokens, URL or destination index.
     */
    default: HecConfigSchema;
    /** HEC settings (overrides for `default`) for events sent to Splunk */
    events?: OptionalHecConfigSchema;
    /** HEC settings (overrides for `default`) for metrics sent to Splunk */
    metrics?: OptionalHecConfigSchema;
    /** HEC settings (overrides for `default`) for internal metrics sent to Splunk */
    internal?: OptionalHecConfigSchema;
}

export interface HecOutputConfig {
    type: 'hec';
    /** A common prefix for all unknown events emitted to Splunk */
    sourceTypePrefix?: string;
    /** Sourcetypes to use for different kinds of events we send to Splunk */
    sourcetypes: SourcetypesSchema;
}

/** Configurable set of `sourcetype` field values emitted by fabriclogger */
export interface SourcetypesSchema {
    /** @default "fabric_logger:block" */
    block?: string;
    /** @default "fabric_logger:endorser_transaction" */
    endorser_transaction?: string;
    /** @default "fabric_logger:ccevent" */
    ccevent?: string;
    /** @default "fabric_logger:config" */
    config?: string;
    /** @default "fabric:node:metrics" */
    nodeMetrics?: string;
}

/** Chaincode event to listen to */
export interface CCEventConfig {
    /** channel name */
    channelName: string;
    /** chaincodeid */
    chaincodeId: string;
    /** block */
    block: number;
}

/** Console output prints all generated events and metrics to STDOUT */
export interface ConsoleOutputConfig {
    type: 'console';
}

/** File output will append all generated messages to a file. (this output type has not been implemented) */
export interface FileOutputConfig {
    type: 'file';
    /** Path to output file */
    path: string;
}

/** Null output will just drop all generated events and metrics */
export interface DevNullOutputConfig {
    type: 'null';
}

export type OutputConfigSchema = HecOutputConfig | ConsoleOutputConfig | FileOutputConfig | DevNullOutputConfig;

export type OutputConfig = OutputConfigSchema;

/** Settings for the Splunk HTTP Event Collector client */
export interface HecConfigSchema {
    /** The URL of HEC. If only the base URL is specified (path is omitted) then the default path will be used */
    url?: string;
    /** The HEC token used to authenticate HTTP requests */
    token?: string;
    /**
     * Defaults for host, source, sourcetype and index. Can be overridden for each message
     * @see [Use variables in metadata](#metadata-variables)
     */
    defaultMetadata?: {
        host?: string;
        source?: string;
        sourcetype?: string;
        index?: string;
    };
    /**
     * Default set of fields to apply to all events and metrics sent with this HEC client
     * @see [Use variables in metadata](#metadata-variables)
     */
    defaultFields?: { [k: string]: any };
    /** Maximum number of entries in the HEC message queue before flushing it */
    maxQueueEntries?: number;
    /** Maximum number of bytes in the HEC message queue before flushing it */
    maxQueueSize?: number;
    /** Maximum number of milliseconds to wait before flushing the HEC message queue */
    flushTime?: DurationConfig;
    /** Gzip compress the request body sent to HEC (Content-Encoding: gzip) */
    gzip?: boolean;
    /** Maximum number of attempts to send a batch to HEC. By default this there is no limit */
    maxRetries?: number;
    /** Number of milliseconds to wait before considering an HTTP request as failed */
    timeout?: DurationConfig;
    /** Set to `false` to disable HTTP keep-alive for connections to Splunk */
    requestKeepAlive?: boolean;
    /** If set to false, the HTTP client will ignore certificate errors (eg. when using self-signed certs) */
    validateCertificate?: boolean;
    /** Maximum number of sockets HEC will use (per host) */
    maxSockets?: number;
    /** User-agent header sent to HEC
     * @default `fabriclogger-hec-client/<version>`
     * @see [Use variables in metadata](#metadata-variables)
     */
    userAgent?: string;
    /** Wait time before retrying to send a (batch of) HEC messages after an error */
    retryWaitTime?: WaitTimeConfig;
    /**
     * Enable sending multiple metrics in a single message to HEC.
     * Supported as of Splunk 8.0.0
     *
     * https://docs.splunk.com/Documentation/Splunk/8.0.0/Metrics/GetMetricsInOther#The_multiple-metric_JSON_format
     */
    multipleMetricFormatEnabled?: boolean;
    /**
     * If set to > 0, then fabriclogger will wait for the HEC service to become available for the given amount of time
     * by periodically attempting to request the collector/health REST endpoint. This can be useful when starting
     * Splunk and fabriclogger for example in docker-compose, where Splunk takes some time to start.
     */
    waitForAvailability?: DurationConfig;
}

export interface HecConfig extends Omit<HecConfigSchema, 'retryWaitTime'> {
    flushTime?: Duration;
    timeout?: Duration;
    retryWaitTime?: WaitTime;
    waitForAvailability?: Duration;
}

export type OptionalHecConfigSchema = Partial<HecConfigSchema>;

export type OptionalHecConfig = Partial<HecConfig>;

export type OptionalScraperConfigDefaults = Partial<ScraperConfigDefaults>;

/**
 * The checkpoint is where fabriclogger keeps track of its state, which blocks have already been processed.
 * This allows it to resume where it left off after being shut down and restarted.
 */
export interface CheckpointConfigSchema {
    /**
     * File path (relative to the current working directory) where the checkpoint file will be stored
     * @default .checkpoints
     */
    filename: string;
    /** Maximum duration before saving updated checkpoint information to disk */
    saveInterval: DurationConfig;
}

export interface CheckpointConfig extends CheckpointConfigSchema {
    saveInterval: Duration;
}

export type Duration = number;

/** Duration specified as golang style duration expression (eg "1h30m") or a number in milliseconds */
export type DurationConfig = number | string;

/** Exponentially increasing wait time with randomness */
export interface ExponentialBackoffConfig {
    type: 'exponential-backoff';
    /** Minimum wait time */
    min?: DurationConfig;
    /** Maximum wait time */
    max?: DurationConfig;
}
/** Linear increasing wait time */
export interface LinearBackoffConfig {
    type: 'linear-backoff';
    /** Minimum wait time (after the first failure) */
    min?: DurationConfig;
    /** Increase of wait time for each failure after the first until max is reached */
    step?: DurationConfig;
    /** Maximum wait time */
    max?: DurationConfig;
}
/**
 * Time to wait between retries. Can either be a fixed duration or a dynamic backoff function
 * where the wait time is determined based on the number of attempts made so far.
 */
export type WaitTimeConfig = DurationConfig | ExponentialBackoffConfig | LinearBackoffConfig;

export function parseDuration(value?: DurationConfig): Duration | undefined {
    if (typeof value === 'string') {
        return durationStringToMs(value);
    }
    return value;
}

export function waitTimeFromConfig(config?: WaitTimeConfig | DeepPartial<WaitTimeConfig>): WaitTime | undefined {
    if (config == null) {
        return undefined;
    }
    if (typeof config === 'number') {
        return config;
    } else if (typeof config === 'string') {
        return parseDuration(config);
    } else if (typeof config === 'object' && 'type' in config) {
        if (config.type === 'exponential-backoff') {
            const args = { min: parseDuration(config.min) ?? 0, max: parseDuration(config.max) };
            debug('Creating exponential-backoff wait time function with args %o', args);
            return exponentialBackoff(args);
        } else if (config.type === 'linear-backoff') {
            if (config.max == null || (config.step ?? 0) > config.max) {
                throw new ConfigError('Invalid linear-backoff wait time specified: max and step values are required');
            }
            const args = {
                min: parseDuration(config.min) ?? 0,
                step: parseDuration(config.step) ?? 1000,
                max: parseDuration(config.max) ?? 10000,
            };
            debug('Creating linear-backoff wait time function with args %o', args);
            return linearBackoff(args);
        } else {
            throw new ConfigError(`Invalid wait time type: ${(config as any).type}`);
        }
    }
    throw new ConfigError(`Invalid wait time config: ${JSON.stringify(config)}`);
}

export type CliFlags<T = typeof CLI_FLAGS> = {
    [P in keyof T]: T[P] extends IOptionFlag<infer R> ? R : any;
};

export const DEFAULT_CONFIG_FILE_NAME = 'fabriclogger.yaml';

export function checkConfig(config: FabricloggerConfig): string[] {
    const problems = [];

    // Check if HEC URL is either specified in defaults or for each enabled metrics/events hec client
    if (config.output.type === 'hec') {
        if (config.hec.default.url == null) {
            problems.push('No URL for HEC events specified. Use --hec-url or configure via fabriclogger.yaml');
        }
    }
    return problems;
}

type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends Array<infer U>
        ? Array<DeepPartial<U>>
        : T[P] extends ReadonlyArray<infer U>
        ? ReadonlyArray<DeepPartial<U>>
        : DeepPartial<T[P]>;
};

const parseBooleanEnvVar = (envVar?: string): boolean | undefined => {
    if (envVar != null) {
        const val = process.env[envVar];
        if (val != null) {
            switch (val.trim().toLowerCase()) {
                case '1':
                case 'true':
                case 'yes':
                case 'on':
                    return true;
                case '0':
                case 'false':
                case 'no':
                case 'off':
                    return false;
                default:
                    throw new ConfigError(
                        `Unexpected value for environment variable ${envVar} - boolean value (true or false) expected`
                    );
            }
        }
    }
};

const parseCCEvents = (value: DeepPartial<CCEventConfig>[] | undefined): CCEvent[] => {
    const ccEvents = [];
    if (value) {
        for (const ccEventConfig of value) {
            if (ccEventConfig['channelName'] && ccEventConfig['chaincodeId']) {
                ccEvents.push({
                    channelName: ccEventConfig['channelName'],
                    chaincodeId: ccEventConfig['chaincodeId'],
                    block: ccEventConfig['block'] || 0,
                });
            }
        }
    }
    return ccEvents;
};

export async function loadConfigFile(
    fileName: string,
    type?: 'json' | 'yaml'
): Promise<DeepPartial<FabricloggerConfigSchema>> {
    let detectedType = type;
    if (type == null) {
        if (fileName.endsWith('.json')) {
            detectedType = 'json';
        } else if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) {
            detectedType = 'yaml';
        } else {
            throw new ConfigError(`Unsupported file format for config path %s (use .yaml or .json file extension)`);
        }
    }
    const fileContents = await readFile(fileName, { encoding: 'utf-8' });
    if (detectedType === 'json') {
        return JSON.parse(fileContents);
    } else if (detectedType === 'yaml') {
        return safeLoad(fileContents, { filename: fileName });
    }

    return {};
}

export async function loadFabricloggerConfig(flags: CliFlags, dryRun: boolean = false): Promise<FabricloggerConfig> {
    const defaultsPath = join(__dirname, '../defaults.fabriclogger.yaml');
    debug('Loading config defaults from %s', defaultsPath);
    let defaults = await loadConfigFile(defaultsPath, 'yaml');
    debug('Loaded config defaults: %O', defaults);

    if (flags['config-file']) {
        const configFromFile = await loadConfigFile(flags['config-file']);
        debug('Loaded config from file %s specified via --config-file flag: %O', flags['config-file'], configFromFile);
        defaults = deepMerge(defaults, configFromFile);
    } else if (await pathExists(DEFAULT_CONFIG_FILE_NAME)) {
        debug('Found default config file %s', DEFAULT_CONFIG_FILE_NAME);
        const configFromFile = await loadConfigFile(DEFAULT_CONFIG_FILE_NAME, 'yaml');
        debug('Loaded config from file %s: %O', DEFAULT_CONFIG_FILE_NAME, configFromFile);
        defaults = deepMerge(defaults, configFromFile);
    } else {
        debug('No config file specified, going with defaults and flag overrides');
    }

    const required = <T>(flag: keyof CliFlags, configValue: T | undefined): T => {
        const val: T = flags[flag];
        if (val == null) {
            if (configValue == null) {
                if (dryRun) {
                    error('Missing required option --%s', flag);
                } else {
                    throw new ConfigError(`Missing required option --${flag}`);
                }
            } else {
                return configValue;
            }
        }
        return val;
    };

    const parsePrometheusEndpointsConfig = (
        value: DeepPartial<PrometheusEndpointConfigSchema[]> | undefined
    ): ScraperEndpoint[] => {
        const prometheusEndpoints = [];
        if (value) {
            for (const prometheusEndpointConfig of value) {
                if (prometheusEndpointConfig) {
                    if (!prometheusEndpointConfig.url) {
                        throw new ConfigError(
                            `Provided Prometheus endpoint does not have 'url' set, which is a required field: ${JSON.stringify(
                                prometheusEndpointConfig
                            )}`
                        );
                    }
                    try {
                        new URL(prometheusEndpointConfig.url);
                    } catch (e) {
                        throw new ConfigError(`Unable to construct URL from provided Prometheus endpoint. ${e}`);
                    }

                    const parsedPrometheusEndpoint = {
                        scrapeInterval: parseDuration(prometheusEndpointConfig.scrapeInterval),
                        scrapeOptions: {
                            url: prometheusEndpointConfig.url,
                            timeout: prometheusEndpointConfig.timeout,
                            allowCompression: prometheusEndpointConfig.allowCompression,
                            validateContentType: prometheusEndpointConfig.validateContentType,
                            validateCertificate: prometheusEndpointConfig.validateCertificate,
                            userAgent: prometheusEndpointConfig.userAgent,
                        },
                    };
                    prometheusEndpoints.push(parsedPrometheusEndpoint);
                }
            }
        }
        return prometheusEndpoints;
    };

    const parseSpecificHecConfig = (
        defaults: DeepPartial<HecConfigSchema> | undefined,
        indexFlag: keyof CliFlags,
        tokenFlag: keyof CliFlags
    ): HecConfig | undefined => {
        const result = removeEmptyValues({
            defaultFields: defaults?.defaultFields,
            defaultMetadata: flags[indexFlag]
                ? Object.assign({}, defaults?.defaultMetadata, { index: flags[indexFlag] })
                : defaults?.defaultMetadata,
            flushTime: parseDuration(defaults?.flushTime),
            gzip: defaults?.gzip,
            maxQueueEntries: defaults?.maxQueueEntries,
            maxQueueSize: defaults?.maxQueueSize,
            maxRetries: defaults?.maxRetries,
            maxSockets: defaults?.maxSockets,
            multipleMetricFormatEnabled: defaults?.multipleMetricFormatEnabled,
            requestKeepAlive: defaults?.requestKeepAlive,
            retryWaitTime: waitTimeFromConfig(defaults?.retryWaitTime as WaitTimeConfig),
            timeout: parseDuration(defaults?.timeout),
            token: flags[tokenFlag] ?? defaults?.token,
            url: defaults?.url,
            userAgent: defaults?.userAgent,
            validateCertificate: defaults?.validateCertificate,
            waitForAvailability: parseDuration(defaults?.waitForAvailability),
        });
        return isEmpty(result) ? undefined : result;
    };

    const parseOutput = (defaults?: Partial<OutputConfigSchema>): OutputConfigSchema => {
        switch (defaults?.type) {
            case 'hec':
                const def = defaults as Partial<HecOutputConfig>;
                return {
                    type: 'hec',
                    sourceTypePrefix: def.sourceTypePrefix,
                    sourcetypes: def.sourcetypes ?? {},
                };
            case 'console':
                return {
                    type: 'console',
                };
            case 'file':
                return {
                    type: 'file',
                    path: (defaults as Partial<FileOutputConfig>)?.path!,
                };
            case 'null':
                return {
                    type: 'null',
                };
            default:
                return {
                    type: 'hec',
                    sourceTypePrefix: '',
                    sourcetypes: {},
                };
        }
    };

    const parseBlockType = (value: string | undefined): BlockType | undefined => {
        switch (value) {
            case 'filtered':
                throw new ConfigError('Config error BlockType filtered is not a supported option');
            case 'full':
            case 'private':
                return value;
            default:
                return undefined;
        }
    };

    const config: FabricloggerConfig = {
        checkpoint: {
            filename: defaults.checkpoint?.filename ?? '.checkpoints',
            saveInterval: parseDuration(defaults.checkpoint?.saveInterval) ?? 100,
        },
        fabric: {
            msp: required('msp', defaults.fabric?.msp),
            networkConfig: required('network', defaults.fabric?.networkConfig),
            user: required('user', defaults.fabric?.user),
            keyFile: required('user-key', defaults.fabric?.keyFile),
            certFile: required('user-cert', defaults.fabric?.certFile),
            clientKeyFile: flags['client-key'] ?? defaults.fabric?.clientKeyFile,
            clientCertFile: flags['client-cert'] ?? defaults.fabric?.clientCertFile,
            channels: defaults.fabric?.channels ?? [],
            ccevents: parseCCEvents(defaults.fabric?.ccevents),
            blockType: parseBlockType(flags['block-type']) ?? defaults.fabric?.blockType,
            discovery: flags['discovery'] ?? defaults.fabric?.discovery,
            asLocalHost: flags['discovery-as-localhost'] ?? defaults.fabric?.asLocalHost,
        },
        prometheus: {
            discovery:
                flags['prometheus-discovery'] ??
                parseBooleanEnvVar(CLI_FLAGS['prometheus-discovery'].env) ??
                defaults.prometheus?.discovery ??
                false,
            defaultOptions: {
                namePrefix: flags['prometheus-name-prefix'] ?? defaults.prometheus?.namePrefix ?? 'fabric',
                scrapeInterval:
                    parseDuration(flags['prometheus-scrape-interval'] ?? defaults.prometheus?.scrapeInterval) ?? 10000,
                port: flags['prometheus-port'] ?? defaults.prometheus?.port ?? '9090',
                path: flags['prometheus-path'] ?? defaults.prometheus?.path ?? '/metrics',
                protocol: flags['prometheus-protocol'] ?? defaults.prometheus?.protocol ?? 'http',
                scrapeOptions: {
                    timeout: defaults.prometheus?.timeout,
                    allowCompression: defaults.prometheus?.allowCompression,
                    validateContentType: defaults.prometheus?.validateContentType,
                    validateCertificate: defaults.prometheus?.validateCertificate,
                    userAgent: defaults.prometheus?.userAgent,
                },
            },
            defaultPeerOptions: {
                port: flags['prometheus-peer-port'] ?? defaults.prometheus?.peerPort,
                path: flags['prometheus-peer-path'] ?? defaults.prometheus?.peerPath,
            },
            defaultOrdererOptions: {
                port: flags['prometheus-orderer-port'] ?? defaults.prometheus?.ordererPort,
                path: flags['prometheus-orderer-path'] ?? defaults.prometheus?.ordererPath,
            },
            endpoints: parsePrometheusEndpointsConfig(defaults.prometheus?.endpoints),
        },
        hec: {
            default: {
                url: required(
                    'hec-url',
                    defaults.hec?.default?.url ?? `https://${flags['splunk-host']}:${flags['splunk-port']}`
                ),
                token: required('hec-token', defaults.hec?.default?.token),
                defaultFields: defaults.hec?.default?.defaultFields,
                defaultMetadata: flags['hec-events-index']
                    ? Object.assign({}, defaults.hec?.default?.defaultMetadata, { index: flags['hec-events-index'] })
                    : defaults.hec?.default?.defaultMetadata,
                flushTime: parseDuration(defaults.hec?.default?.flushTime),
                gzip: defaults.hec?.default?.gzip,
                maxQueueEntries: defaults.hec?.default?.maxQueueEntries,
                maxQueueSize: defaults.hec?.default?.maxQueueSize,
                maxRetries: defaults.hec?.default?.maxRetries ?? Infinity,
                maxSockets: defaults.hec?.default?.maxSockets,
                multipleMetricFormatEnabled: defaults.hec?.default?.multipleMetricFormatEnabled,
                requestKeepAlive: defaults.hec?.default?.requestKeepAlive,
                retryWaitTime: waitTimeFromConfig(defaults.hec?.default?.retryWaitTime as WaitTimeConfig),
                timeout: parseDuration(defaults.hec?.default?.timeout),
                userAgent: defaults.hec?.default?.userAgent,
                waitForAvailability: parseDuration(defaults.hec?.default?.waitForAvailability),
                validateCertificate:
                    flags['hec-reject-invalid-certs'] ??
                    parseBooleanEnvVar(CLI_FLAGS['hec-reject-invalid-certs'].env) ??
                    defaults.hec?.default?.validateCertificate,
            },
            events: parseSpecificHecConfig(defaults.hec?.events, 'hec-events-index', 'hec-events-token'),
            metrics: parseSpecificHecConfig(defaults.hec?.metrics, 'hec-metrics-index', 'hec-metrics-token'),
            internal: parseSpecificHecConfig(defaults.hec?.internal, 'hec-internal-index', 'hec-internal-token'),
        },
        output: parseOutput(defaults.output),
    };

    const result = config as FabricloggerConfig;

    const problems = checkConfig(result);

    if (problems.length > 0) {
        for (const msg of problems) {
            error('Detected problem in fabriclogger config: %s', msg);
        }
        if (!dryRun) {
            throw new ConfigError(
                problems.length > 1 ? 'Detected multiple problems in fabriclogger configuration, see logs' : problems[0]
            );
        }
    }

    return result;
}

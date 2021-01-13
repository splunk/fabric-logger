/* eslint-disable no-console */
import { sleep } from '@splunkdlt/async-tasks';
import { createModuleDebug } from '@splunkdlt/debug-logging';
import { Output } from './output';
import { Duration, PrometheusConfig } from './config';
import { convertToHecMultiMetrics, scrapePrometheusMetrics, ScrapeOptions } from '@splunkdlt/prometheus-scraper';
import { ManagedResource } from '@splunkdlt/managed-resource';
import { deepMerge } from './utils/obj';
import { FabricConnectionProfile } from './types/connectionProfile';
import { FetchError } from 'node-fetch';
import { readFile } from 'fs-extra';
import { safeLoad } from 'js-yaml';

const { debug, info, error } = createModuleDebug('prometheus-metrics');

export interface BaseScraperConfig {
    scrapeInterval?: Duration;
    namePrefix?: string;
}

export interface ScraperConfigDefaults extends BaseScraperConfig {
    scrapeInterval: Duration;
    scrapeOptions?: Partial<ScrapeOptions>;
    path: string;
    port: string;
    protocol: string;
}

export interface ScraperEndpoint extends BaseScraperConfig {
    scrapeOptions: ScrapeOptions;
}

export interface ScraperConfig extends ScraperEndpoint {
    scrapeInterval: Duration;
}

export function generateScraperEndpoint(host: string, defaults: ScraperConfigDefaults): ScraperEndpoint {
    const parsedEndpoint = new URL(`http://${host}`);
    parsedEndpoint.protocol = defaults.protocol;
    parsedEndpoint.pathname = defaults.path;
    parsedEndpoint.port = defaults.port;
    return {
        scrapeOptions: {
            url: parsedEndpoint.toString(),
        },
    };
}

export function generateScraperConfigFromHostname(host: string, defaults: ScraperConfigDefaults): ScraperConfig {
    return generateScraperConfig(generateScraperEndpoint(host, defaults), defaults);
}

export function generateScraperConfig(endpoint: ScraperEndpoint, defaults: ScraperConfigDefaults): ScraperConfig {
    return deepMerge(defaults, endpoint as Partial<ScraperConfigDefaults>) as ScraperConfig;
}

export class InvalidPrometheusEndpointError extends Error {
    constructor(msg: string) {
        super(msg);
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor);
        } else {
            this.stack = new Error(msg).stack;
        }
    }
}

export class PrometheusMetricsScraper implements ManagedResource {
    private config: PrometheusConfig;
    private output: Output;
    private networkConfig: string;
    private default: {
        base: ScraperConfigDefaults;
        peer: ScraperConfigDefaults;
        orderer: ScraperConfigDefaults;
    };
    public prometheusScrapers: { [name: string]: PrometheusEndpointScraper } = {};

    constructor(config: PrometheusConfig, networkConfig: string, output: Output) {
        this.config = config;
        this.output = output;
        this.networkConfig = networkConfig;

        const defaultBase = this.config.defaultOptions;
        const defaultPeer = deepMerge(
            this.config.defaultOptions,
            this.config.defaultPeerOptions ?? {}
        ) as ScraperConfigDefaults;
        const defaultOrderer = deepMerge(
            this.config.defaultOptions,
            this.config.defaultOrdererOptions ?? {}
        ) as ScraperConfigDefaults;
        this.default = { base: defaultBase, peer: defaultPeer, orderer: defaultOrderer };
    }

    public hasPrometheusEndpointScraper(name: string): boolean {
        const scraper = this.prometheusScrapers[name];
        return scraper != null;
    }

    public async parseSpecificEndpoints(): Promise<void> {
        for (const endpointConfig of this.config.endpoints) {
            if (!this.hasPrometheusEndpointScraper(endpointConfig.scrapeOptions.url)) {
                const scraperConfig = deepMerge(
                    this.default.base,
                    endpointConfig as Partial<ScraperConfigDefaults>
                ) as ScraperConfig;
                const prometheusScraper = new PrometheusEndpointScraper(scraperConfig, this.output);
                this.prometheusScrapers[endpointConfig.scrapeOptions.url] = prometheusScraper;
            }
        }
    }

    public async checkAvailable(scraperConfig: ScraperConfig, maxTime: number = 10_000): Promise<boolean> {
        debug(
            'Checking discovered Prometheus endpoint %s availability (timeout %d ms)',
            scraperConfig.scrapeOptions.url,
            maxTime
        );
        const url = new URL(scraperConfig.scrapeOptions.url);

        try {
            await scrapePrometheusMetrics({
                url: url.toString(),
                retryOptions: {
                    taskName: `prometheus-scrape[${url.host}]`,
                    waitBetween: 2000,
                    attempts: 5,
                    onRetry: (attempt) => {
                        debug('Retrying availability check on host=%s attempt=%d', url.host, attempt);
                    },
                    onError: (e, attempt) => {
                        debug('Failed availability check on host=%s: attempt=%d %s', url.host, attempt, e.stack);
                        if (e instanceof FetchError) {
                            if (e.type === 'system' && e.errno) {
                                if (['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT'].includes(e.errno)) {
                                    throw new InvalidPrometheusEndpointError(`Prometheus endpoint errored with ${e}`);
                                }
                            }
                        }
                    },
                },
            });
        } catch (e) {
            debug('Prometheus endpoint %s is unavailable.', scraperConfig.scrapeOptions.url);
            return false;
        }
        debug('Prometheus endpoint %s is available.', scraperConfig.scrapeOptions.url);
        return true;
    }

    public async initScrapers(): Promise<void> {
        await this.parseSpecificEndpoints();
        await this.discover();
    }

    public async start(): Promise<void> {
        for (const [name, scraper] of Object.entries(this.prometheusScrapers)) {
            info('Starting Prometheus scraper:', name);
            scraper.scrape().catch((e) => error('%s scraper encountered error:', name, e));
        }

        if (Object.keys(this.prometheusScrapers).length === 0) {
            info('No Prometheus endpoints are configured to be scraped.');
        }
    }

    public async shutdown(): Promise<void> {
        for (const [, scraper] of Object.entries(this.prometheusScrapers)) {
            scraper.shutdown();
        }
    }

    public async discover(): Promise<void> {
        if (!this.config.discovery) {
            info('Not attempting to discover Prometheus endpoints.');
            return;
        }

        info('Attempting to discover Prometheus endpoints from %s.', this.networkConfig);
        const connectionProfileYaml = await readFile(this.networkConfig, { encoding: 'utf-8' });
        const connectionProfile: FabricConnectionProfile = safeLoad(connectionProfileYaml);

        // Iterate through the peers and orders defined in the connection profile
        // and try to instantiate scrapers for them.
        const candidates: ScraperConfig[] = [];
        for (const peerEndpoint in connectionProfile.peers) {
            const scraperConfig = generateScraperConfigFromHostname(peerEndpoint, this.default.peer);
            if (!this.hasPrometheusEndpointScraper(scraperConfig.scrapeOptions.url)) {
                candidates.push(scraperConfig);
            }
        }

        for (const ordererEndpoint in connectionProfile.orderers) {
            const scraperConfig = generateScraperConfigFromHostname(ordererEndpoint, this.default.orderer);
            if (!this.hasPrometheusEndpointScraper(scraperConfig.scrapeOptions.url)) {
                candidates.push(scraperConfig);
            }
        }

        const verifiedCandidates: string[] = [];
        for (const scraperConfig of candidates) {
            if (!this.hasPrometheusEndpointScraper(scraperConfig.scrapeOptions.url)) {
                if (await this.checkAvailable(scraperConfig)) {
                    verifiedCandidates.push(scraperConfig.scrapeOptions.url);
                    const scraper = new PrometheusEndpointScraper(scraperConfig, this.output);
                    this.prometheusScrapers[scraperConfig.scrapeOptions.url] = scraper;
                }
            }
        }
        info('Discovered and verified the following Prometheus endpoints: %s', verifiedCandidates);
    }
}

export class PrometheusEndpointScraper {
    private active: boolean = true;
    private output: Output;
    private scrapeInterval: Duration;
    private config: ScraperConfig;
    private host: string;

    constructor(config: ScraperConfig, output: Output) {
        this.scrapeInterval = config.scrapeInterval;
        this.config = config;
        this.host = new URL(this.config.scrapeOptions.url).hostname;
        this.output = output;
    }

    public async shutdown(): Promise<void> {
        info('Shutting down scraper', this.config.scrapeOptions.url);
        this.active = false;
    }

    public async scrape(): Promise<void> {
        debug('Starting scrape loop with config', this.host, this.scrapeInterval, this.config);

        while (this.active) {
            const scrapeResult = await scrapePrometheusMetrics(this.config.scrapeOptions);
            const convertedMetrics = convertToHecMultiMetrics(scrapeResult.metrics, {
                captureTimestamp: Date.now(),
                namePrefix: this.config.namePrefix,
                metadata: {
                    host: this.host,
                },
            });
            if (this.active) {
                for (const hecMetrics of convertedMetrics) {
                    this.output.logMultiMetrics({
                        type: 'nodeMetrics',
                        ...hecMetrics,
                    });
                }
                await sleep(this.scrapeInterval);
            }
        }
    }
}

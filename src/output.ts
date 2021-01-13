import { createModuleDebug } from '@splunkdlt/debug-logging';
import { pathExists, mkdir, writeFile } from 'fs-extra';
import { join } from 'path';
import { convertBuffers } from './convert';
import { HecClient } from '@splunkdlt/hec-client';
import { ManagedResource } from '@splunkdlt/managed-resource';
import { FabricloggerConfig, HecOutputConfig } from './config';
import {
    BlockMessage,
    ConfigMessage,
    ChaincodeEventMessage,
    TransactionEventMessage,
    NodeMetricsMessage,
    UnKnownMessage,
} from './msgs';

export type OutputMessage =
    | BlockMessage
    | ConfigMessage
    | ChaincodeEventMessage
    | TransactionEventMessage
    | UnKnownMessage;

export type MetricsMessage = NodeMetricsMessage;

const { debug } = createModuleDebug('output');
const filenameSafe = (name: string): string => name.replace(/[^\w]+/g, '_');
const randSuffix = () => Math.floor(Math.random() * 0xfffffff).toString(36);

export interface Output extends ManagedResource {
    logEvent(event: OutputMessage, timeField: Date | undefined, source?: string): void;
    logMultiMetrics(metrics: MetricsMessage): void;
    waitUntilAvailable?(maxTime: number): Promise<void>;
}

export class HecOutput implements Output, ManagedResource {
    constructor(private eventsHec: HecClient, private metricsHec: HecClient, private config: HecOutputConfig) {}

    public logMultiMetrics(message: MetricsMessage, source: string = 'fabriclogger'): void {
        this.metricsHec.pushMetrics({
            ...message,
            metadata: {
                host: message?.metadata?.host,
                source: source,
                sourcetype: this.config.sourcetypes[message.type],
            },
        });
    }

    public logEvent(message: OutputMessage, timeField: Date | undefined, source: string = 'fabriclogger'): void {
        const event = convertBuffers(message);
        switch (message.type) {
            case 'block':
            case 'endorser_transaction':
            case 'config':
            case 'ccevent':
                this.eventsHec.pushEvent({
                    time: timeField ? timeField : new Date(),
                    body: {
                        ...event,
                    },
                    metadata: {
                        source: source,
                        sourcetype: this.config.sourcetypes[message.type],
                    },
                });
                break;
            default:
                this.eventsHec.pushEvent({
                    time: timeField ? timeField : new Date(),
                    body: {
                        ...event,
                    },
                    metadata: {
                        source: source,
                        sourcetype: `${this.config.sourceTypePrefix}:${message.type}`,
                    },
                });
        }
    }

    public waitUntilAvailable(maxTime: number): Promise<void> {
        if (this.eventsHec === this.metricsHec || this.eventsHec.config.url === this.metricsHec.config.url) {
            return this.eventsHec.waitUntilAvailable(maxTime);
        }
        return Promise.all([
            this.eventsHec.waitUntilAvailable(maxTime),
            this.metricsHec.waitUntilAvailable(maxTime),
        ]).then(() => Promise.resolve());
    }

    public async shutdown(): Promise<void> {
        return Promise.all([this.eventsHec.shutdown(), this.metricsHec.shutdown()]).then(() => {
            /* noop */
        });
    }
}

export class FileOutput implements Output {
    constructor(private outputDir: string) {}

    public async createOutputDirectory(): Promise<string> {
        const tempDir = join(process.cwd(), 'temp');
        if (!(await pathExists(tempDir))) {
            debug('Creating temp dir', tempDir);
            await mkdir(tempDir);
        }
        const outputDir = join(tempDir, 'output');
        if (!(await pathExists(outputDir))) {
            debug('Creating output dir', outputDir);
            await mkdir(outputDir);
        }
        return outputDir;
    }

    public async logEvent(event: OutputMessage): Promise<void> {
        const meta = {};
        const { sourcetype = 'unknown_sourcetype', time = Date.now() } = meta as any;
        const fileName = `event_${filenameSafe(sourcetype)}_${time}_${randSuffix()}.json`;
        debug(`Writing event to file`, fileName);
        await writeFile(join(this.outputDir, fileName), JSON.stringify(event, null, 2), { encoding: 'utf-8' });
    }

    public async logMultiMetrics(metrics: MetricsMessage): Promise<void> {
        const meta = {};
        const { sourcetype = 'unknown_sourcetype', time = Date.now() } = meta as any;
        const fileName = `event_${filenameSafe(sourcetype)}_${time}_${randSuffix()}.json`;
        debug(`Writing event to file`, fileName);
        await writeFile(join(this.outputDir, fileName), JSON.stringify(metrics, null, 2), { encoding: 'utf-8' });
    }

    public async shutdown(): Promise<void> {
        // noop
    }
}

export class ConsoleOutput implements Output {
    logEvent(message: OutputMessage): void {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(message));
    }
    logMultiMetrics(message: MetricsMessage): void {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(message));
    }
    public async shutdown(): Promise<void> {
        // noop
    }
}

export async function createOutput(config: FabricloggerConfig, baseHecClient: HecClient): Promise<Output> {
    if (config.output.type === 'hec') {
        const eventsHec = config.hec.events ? baseHecClient.clone(config.hec.events) : baseHecClient;
        const metricsHec = config.hec.metrics ? baseHecClient.clone(config.hec.metrics) : baseHecClient;
        const hecOutput = new HecOutput(eventsHec, metricsHec, config.output);
        return hecOutput;
    } else if (config.output.type === 'console') {
        return new ConsoleOutput();
    } else if (config.output.type === 'file') {
        return new FileOutput(config.output.path);
    }
    throw new Error(`Invalid output type: ${((config.output as any) ?? {}).type}`);
}

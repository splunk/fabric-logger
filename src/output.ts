import { createModuleDebug } from '@splunkdlt/debug-logging';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { convertBuffersToHex } from './convert';
import { HecClient } from '@splunkdlt/hec-client';
import { ManagedResource } from '@splunkdlt/managed-resource';
import { FabricloggerConfig, HecOutputConfig } from './config';
import { BlockMessage, ConfigMessage, EndorserTransactionMessage, ChaincodeEventMessage, UnKnownMessage } from './msgs';

const exists = promisify(fs.exists);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

export type OutputMessage =
    | BlockMessage
    | ConfigMessage
    | EndorserTransactionMessage
    | ChaincodeEventMessage
    | UnKnownMessage;

const { debug } = createModuleDebug('output');

export interface Output extends ManagedResource {
    logEvent(event: OutputMessage, timeField: Date | undefined, source: string): void;
    waitUntilAvailable?(maxTime: number): Promise<void>;
}

export class HecOutput implements Output, ManagedResource {
    constructor(private eventsHec: HecClient, private metricsHec: HecClient, private config: HecOutputConfig) {}
    public logEvent(message: OutputMessage, timeField: Date | undefined, source: string): void {
        const event = convertBuffersToHex(message);
        switch (message.type) {
            case 'block':
            case 'endorserTransaction':
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

    public async shutdown() {
        return Promise.all([this.eventsHec.shutdown(), this.metricsHec.shutdown()]).then(() => {
            /* noop */
        });
    }
}

export class FileOutput implements Output {
    private filenameSafe = (name: string): string => name.replace(/[^\w]+/g, '_');

    constructor(private outputDir: string) {}

    public async createOutputDirectory(): Promise<string> {
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

    private randSuffix = () => Math.floor(Math.random() * 0xfffffff).toString(36);

    public logEvent(event: any): void {
        const meta = event.metadata || {};
        const { sourcetype = 'unkown_sourcetype', time = Date.now() } = meta as any;
        const fileName = `event_${this.filenameSafe(sourcetype)}_${time}_${this.randSuffix()}.json`;
        debug(`Writing event to file`, fileName);
        writeFile(path.join(this.outputDir, fileName), JSON.stringify(event, null, 2), { encoding: 'utf-8' });
    }

    public async shutdown() {
        // noop
    }
}

export class ConsoleOutput implements Output {
    logEvent(message: any): void {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(message));
    }
    public async shutdown() {
        // noop
    }
}

export async function createOutput(config: FabricloggerConfig, baseHecClient: HecClient): Promise<Output> {
    if (config.output.type === 'hec') {
        const eventsHec = config.hec.default ? baseHecClient.clone(config.hec.default) : baseHecClient;
        const metricsHec = config.hec.default ? baseHecClient.clone(config.hec.default) : baseHecClient;
        const hecOutput = new HecOutput(eventsHec, metricsHec, config.output);
        return hecOutput;
    } else if (config.output.type === 'console') {
        return new ConsoleOutput();
    } else if (config.output.type === 'file') {
        return new FileOutput(config.output.path);
    }
    throw new Error(`Invalid output type: ${((config.output as any) ?? {}).type}`);
}

import { Command } from '@oclif/command';
import debugModule from 'debug';
import { inspect } from 'util';
import { createModuleDebug, enableTraceLogging } from '@splunkdlt/debug-logging';
import { CLI_FLAGS } from './cliflags';
import { FabricloggerConfig, loadFabricloggerConfig } from './config';
import { Checkpoint } from './checkpoint';
import { FabricListener } from './fabric';
import { createOutput } from './output';
import { waitForSignal } from './utils/signal';
import { substituteVariablesInHecConfig } from './meta';
import { HecClient } from '@splunkdlt/hec-client';
import { PrometheusMetricsScraper } from './prometheus';
import { ManagedResource, shutdownAll } from '@splunkdlt/managed-resource';

const { debug, info, error } = createModuleDebug('main');

class Fabriclogger extends Command {
    static description = 'Splunk Connect for Hyperledger Fabric';
    static flags = CLI_FLAGS;

    private resources: ManagedResource[] = [];

    async run(): Promise<void> {
        if (process.env.FABRIC_LOGGER_GIT_COMMIT != null) {
            this.config.userAgent = `${this.config.userAgent} git-sha=${process.env.FABRIC_LOGGER_GIT_COMMIT}`;
        }
        const { flags } = this.parse(Fabriclogger);
        if (flags.debug) {
            debugModule.enable('fabriclogger:*');
            debug('Starting fabric logger...');
        }
        if (flags.trace) {
            enableTraceLogging();
        }

        try {
            if (flags['print-config']) {
                const config = await loadFabricloggerConfig(flags, true);
                debug('Printing config');
                // eslint-disable-next-line no-console
                console.log(inspect(config, { depth: 10, colors: true, showHidden: false, compact: false }));
                await loadFabricloggerConfig(flags);
                return;
            }

            const config = await loadFabricloggerConfig(flags);

            info('Starting fabric logger version=%s', this.config.userAgent);
            await this.startFabriclogger(config);

            await Promise.race([waitForSignal('SIGINT'), waitForSignal('SIGTERM')]);
            info('Received signal, proceeding with shutdown sequence');
            const cleanShutdown = await shutdownAll(this.resources, 10_000);
            info('Shutdown complete.');
            process.exit(cleanShutdown ? 0 : 2);
        } catch (e) {
            error(e.message, { exit: 1 });
        } finally {
            await shutdownAll(this.resources, 10_000).catch((e) => {
                error('Failed to shut down resources', e);
            });
        }
    }

    async startFabriclogger(config: FabricloggerConfig): Promise<void> {
        substituteVariablesInHecConfig(config, {
            fabricloggerVersion: this.config.version,
        });

        const checkpoint = new Checkpoint(config.checkpoint.filename);
        await checkpoint.loadCheckpoints();
        this.resources.push(checkpoint);

        const hecClient = new HecClient(config.hec.default);
        const output = await createOutput(config, hecClient);
        this.resources.push(output);

        const fabricListener = new FabricListener(checkpoint, config.fabric, config.integrity, output);
        this.resources.push(fabricListener);
        await fabricListener.initClient();
        await fabricListener.listen();

        const prometheusMetricsScraper = new PrometheusMetricsScraper(
            config.prometheus,
            config.fabric.networkConfig,
            output
        );
        await prometheusMetricsScraper.initScrapers();
        await prometheusMetricsScraper.start();
        this.resources.push(prometheusMetricsScraper);
    }
}

export = Fabriclogger;

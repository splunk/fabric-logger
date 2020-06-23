import { Command } from '@oclif/command';
import debugModule from 'debug';
import { createModuleDebug, enableTraceLogging } from '@splunkdlt/debug-logging';
import { CLI_FLAGS } from './cliflags';
import { FabricloggerConfig, loadFabricloggerConfig } from './config';
import { Checkpoint } from './checkpoint';
import { FabricListener } from './fabric';
import { FabricLoggerServer } from './server';
import { createOutput } from './output';
import { waitForSignal } from './utils/signal';
import { HecClient } from '@splunkdlt/hec-client';
import { ManagedResource, shutdownAll } from '@splunkdlt/managed-resource';

const { debug, info, error } = createModuleDebug('main');

class Fabriclogger extends Command {
    static description = 'Splunk Connect for Hyperledger Fabric';
    static flags = CLI_FLAGS;

    private resources: ManagedResource[] = [];

    async run() {
        const { flags } = this.parse(Fabriclogger);
        if (flags.debug) {
            debugModule.enable('fabriclogger:*');
            debug('Starting fabric logger...');
        }
        if (flags.trace) {
            enableTraceLogging();
        }

        try {
            const config = await loadFabricloggerConfig(flags);
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

    async startFabriclogger(config: FabricloggerConfig): Promise<any> {
        const checkpoint = new Checkpoint(config.checkpoint.filename);
        await checkpoint.loadCheckpoints();
        this.resources.push(checkpoint);

        const hecClient = new HecClient(config.hec.default);
        const output = await createOutput(config, hecClient);
        this.resources.push(output);

        const fabricListener = new FabricListener(checkpoint, config.fabric, output);
        this.resources.push(fabricListener);
        await fabricListener.initClient();
        await fabricListener.listen();

        const fabricServer = new FabricLoggerServer(fabricListener);
        this.resources.push(fabricServer);

        return Promise.all([fabricServer.startServer('0.0.0.0', 8080)]);
    }
}

export = Fabriclogger;

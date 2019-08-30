import { createModuleDebug } from './debug';
import { initializeEnvironment } from './env';
import { loadCheckpoints, getAllChannelsWithCheckpoints } from './checkpoint';
import { initClient as initFabricClient, registerListener } from './fabric';
import { startServer } from './server';
import { initializeLogOutput } from './output';

const { debug, info, error } = createModuleDebug('main');

async function main() {
    debug('Starting fabric logger...');
    initializeEnvironment();
    initializeLogOutput();
    await loadCheckpoints();
    initFabricClient();
    await startServer('0.0.0.0', 8080);

    await new Promise(r => setTimeout(r, 1000));
    for (const channel of getAllChannelsWithCheckpoints()) {
        info('Resuming listener for channel=%s', channel);
        await registerListener(channel);
    }
}

main().catch(e => {
    error(`Error starting fabric logger `, e);
    process.exit(1);
});

import { createModuleDebug } from './debug';
import { initializeEnvironment } from './env';
import { loadCheckpoints } from './checkpoint';
import { initClient as initFabricClient } from './fabric';
import { startServer } from './server';
import { initializeLogOutput } from './output';

const { debug, error } = createModuleDebug('main');

async function main() {
    debug('Starting fabric logger...');
    initializeEnvironment();
    initializeLogOutput();
    await loadCheckpoints();
    initFabricClient();
    await startServer('0.0.0.0', 8080);
}

main().catch(e => {
    error(`Error starting fabric logger `, e);
    process.exit(1);
});

import { debug as createDebug } from 'debug';
import { readFile, writeFile } from 'fs-extra';

const debug = createDebug('update-version');
debug.enabled = true;

async function replaceLineInFile(fileName: string, lineStartsWith: string, replacement: string) {
    const fileContents = await readFile(fileName, { encoding: 'utf-8' });

    const toWrite = new Array<String>();
    for (const line of fileContents.split('\n')) {
        if (line.startsWith(lineStartsWith)) {
            toWrite.push(replacement);
        } else {
            toWrite.push(line);
        }
    }
    await writeFile(fileName, toWrite.join('\n'));
}

async function updatek8s(newVersion: string) {
    debug(`Updating version of chart to ${newVersion}`);
    await replaceLineInFile('helm-chart/fabric-logger/Chart.yaml', 'version: ', 'version: ' + newVersion);
    await replaceLineInFile('helm-chart/fabric-logger/Chart.yaml', 'appVersion: ', 'appVersion: ' + newVersion);
    await replaceLineInFile('helm-chart/fabric-logger/values.yaml', '  version: ', '  version: ' + newVersion);
}

async function updateReadme(newVersion: string) {
    const filename = 'README.md';
    debug(`Updating versions in ${filename} to ${newVersion}`);
    const fileContents = await readFile(filename, { encoding: 'utf-8' });
    const newContents = fileContents
        .replace(/fabric-logger-helm-.*\.tgz/g, `fabric-logger-helm-${newVersion}.tgz`)
        .replace(
            /https:\/\/github.com\/splunk\/fabric-logger\/releases\/download\/.*\/fabric-logger-helm-.*tgz/g,
            `https://github.com/splunk/fabric-logger/releases/download/${newVersion}/fabric-logger-helm-${newVersion}.tgz`
        )
        .replace(/fabric-logger:release-.*/g, `fabric-logger:release-${newVersion}`);
    await writeFile(filename, newContents);
}

async function main() {
    const newVersion = process.argv[process.argv.length - 1];
    updatek8s(newVersion);
    updateReadme(newVersion);
}

main().catch((e) => {
    debug('FATAL', e);
    process.exit(1);
});

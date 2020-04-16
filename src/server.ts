import * as express from 'express';
import { hasListener, registerListener, removeListener, registerChaincodeEvent } from './fabric';
import { FABRIC_PEER } from './env';
import { createModuleDebug } from './debug';
import { Server } from 'http';

const { debug, info, error } = createModuleDebug('server');
const app = express();

app.use((req, res, next) => {
    if (req.url == '/healthcheck') {
        debug(`Incoming request %s %s`, req.method, req.url);
    } else {
        info(`Incoming request %s %s`, req.method, req.url);
    }
    next();
});

app.use(express.json());

// Leaving get for backwards compatibility
app.get('/channels/:channel', async (req, res) => {
    const channel = req.params['channel'];
    // Only one listener required per channel per peer.
    if (hasListener(channel)) {
        res.status(304);
        res.send(`Fabric logger already started on ${channel} on peer ${FABRIC_PEER}.\n`);
        return;
    }

    try {
        await registerListener(channel);
        res.status(201);
        res.send(`Connecting to ${req.params['channel']} on ${FABRIC_PEER}\n`);
    } catch (e) {
        error('Failed to register new channel listener', e.message);
        res.sendStatus(500);
    }
});

app.put('/channels/:channel', async (req, res) => {
    const channel = req.params['channel'];
    // Only one listener required per channel per peer.
    if (hasListener(channel)) {
        res.status(304);
        res.send(`Fabric logger already started on ${channel} on peer ${FABRIC_PEER}.\n`);
        return;
    }

    try {
        await registerListener(channel);
        res.status(201);
        res.send(`Connecting to ${req.params['channel']} on ${FABRIC_PEER}\n`);
    } catch (e) {
        error('Failed to register new channel listener', e.message);
        res.sendStatus(500);
    }
});

app.put('/channels/:channel/events/:ccid', async (req, res) => {
    const channel = req.params['channel'];
    const ccid = req.params['ccid'];
    if (!req.body.filter) {
        res.status(400);
        res.send('Failed to register Chaincode event listener.  Request requires filter parameter in body');
    }
    const filter = req.body.filter.toString();
    const name = `${channel}_${ccid}_${filter}`;

    if (hasListener(name)) {
        res.status(304);
        res.send(
            `Fabric logger already started event listener for ${filter} of ${ccid} on channel ${channel} on peer ${FABRIC_PEER}.\n`
        );
        return;
    }

    try {
        await registerChaincodeEvent(channel, ccid, filter);
        res.status(201);
        res.send(`Listening to Chaincode: ${ccid} filter: ${filter} events on channel ${channel}`);
    } catch (e) {
        error('Failed to register new chaincode event ', e.message);
        res.sendStatus(500);
    }
});

app.delete('/channels/:channel', (req, res) => {
    removeListener(req.params.channel);
    res.sendStatus(202);
});

app.delete('/channels/:channel/events/:ccid/:filter', (req, res) => {
    const name = `${req.params.channel}_${req.params.ccid}_${req.params.filter}`;
    removeListener(name);
    res.sendStatus(202);
});

app.get('/healthcheck', (req, res) => {
    res.status(200);
    res.send('ok!');
});

export function startServer(host: string, port: number): Promise<Server> {
    debug('Starting webserver on host=%s and port=%d', host, port);
    return new Promise((resolve, reject) => {
        const server = app.listen(port, host, err => {
            if (err) {
                reject(err);
            } else {
                info('Listening on http://%s:%d', host, port);
                resolve(server);
            }
        });
    });
}

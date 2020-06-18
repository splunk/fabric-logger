import * as express from 'express';
import { FabricListener } from './fabric';
import { createModuleDebug } from '@splunkdlt/debug-logging';
import { Server, createServer } from 'http';
import { ManagedResource } from '@splunkdlt/managed-resource';

const { debug, info, error } = createModuleDebug('server');

export class FabricLoggerServer implements ManagedResource {
    private app: express.Application;
    private fabricListener: FabricListener;
    private server: Server;

    constructor(fabricListener: FabricListener) {
        this.fabricListener = fabricListener;
        this.app = express();
        this.server = createServer(this.app);
        this.initializeMiddlewares();
        this.initializeRoutes();
    }

    public async shutdown(): Promise<void> {
        this.server.close();
    }

    private initializeMiddlewares() {
        this.app.use((req: any, res: any, next: any) => {
            if (req.url == '/healthcheck') {
                debug(`Incoming request %s %s`, req.method, req.url);
            } else {
                info(`Incoming request %s %s`, req.method, req.url);
            }
            next();
        });

        this.app.use(express.json());
    }

    private initializeRoutes() {
        // Leaving get for backwards compatibility
        this.app.get('/channels/:channel', async (req, res) => {
            const channel = req.params['channel'];
            // Only one listener required per channel per peer.
            if (this.fabricListener.hasListener(channel)) {
                res.status(304);
                res.send(`Fabric logger already started on ${channel} .\n`);
                return;
            }

            try {
                await this.fabricListener.registerListener(channel);
                res.status(201);
                res.send(`Connecting to ${req.params['channel']} \n`);
            } catch (e) {
                error('Failed to register new channel listener', e.message);
                res.sendStatus(500);
            }
        });

        this.app.put('/channels/:channel', async (req, res) => {
            const channel = req.params['channel'];
            // Only one listener required per channel per peer.
            if (this.fabricListener.hasListener(channel)) {
                res.status(304);
                res.send(`Fabric logger already started on ${channel}.\n`);
                return;
            }

            try {
                await this.fabricListener.registerListener(channel);
                res.status(201);
                res.send(`Connecting to ${req.params['channel']} \n`);
            } catch (e) {
                error('Failed to register new channel listener', e.message);
                res.sendStatus(500);
            }
        });

        this.app.put('/channels/:channel/events/:ccid', async (req, res) => {
            const channel = req.params['channel'];
            const ccid = req.params['ccid'];
            if (!req.body.filter) {
                res.status(400);
                res.send('Failed to register Chaincode event listener.  Request requires filter parameter in body');
            }
            const filter = req.body.filter.toString();
            const name = `${channel}_${ccid}_${filter}`;

            if (this.fabricListener.hasListener(name)) {
                res.status(304);
                res.send(
                    `Fabric logger already started event listener for ${filter} of ${ccid} on channel ${channel}.\n`
                );
                return;
            }

            try {
                await this.fabricListener.registerChaincodeEvent(channel, ccid, filter);
                res.status(201);
                res.send(`Listening to Chaincode: ${ccid} filter: ${filter} events on channel ${channel}`);
            } catch (e) {
                error('Failed to register new chaincode event ', e.message);
                res.sendStatus(500);
            }
        });

        this.app.delete('/channels/:channel', (req, res) => {
            this.fabricListener.removeListener(req.params.channel);
            res.sendStatus(202);
        });

        this.app.delete('/channels/:channel/events/:ccid/:filter', (req, res) => {
            const name = `${req.params.channel}_${req.params.ccid}_${req.params.filter}`;
            this.fabricListener.removeListener(name);
            res.sendStatus(202);
        });

        this.app.get('/healthcheck', (req, res) => {
            res.status(200);
            res.send('ok!');
        });
    }

    public async startServer(host: string, port: number): Promise<any> {
        debug('Starting webserver on host=%s and port=%d', host, port);
        new Promise((resolve, reject) => {
            this.server = this.app.listen(port, host, (err) => {
                if (err) {
                    reject(err);
                } else {
                    info('Listening on http://%s:%d', host, port);
                    resolve(null);
                }
            });
        });
    }
}

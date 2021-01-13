import { debug } from 'debug';
import { loadFabricloggerConfig, CliFlags } from '../src/config';

beforeAll(() => {
    debug.log = () => {
        // ignore
    };
});

test('defaults', async () => {
    await expect(loadFabricloggerConfig({} as CliFlags, true)).resolves.toMatchInlineSnapshot(`
Object {
  "checkpoint": Object {
    "filename": ".checkpoints",
    "saveInterval": 250,
  },
  "fabric": Object {
    "asLocalHost": false,
    "blockType": "full",
    "ccevents": Array [],
    "certFile": undefined,
    "channels": Array [],
    "clientCertFile": undefined,
    "clientKeyFile": undefined,
    "discovery": false,
    "keyFile": undefined,
    "msp": undefined,
    "networkConfig": "network.yaml",
    "user": "fabric-logger",
  },
  "hec": Object {
    "default": Object {
      "defaultFields": undefined,
      "defaultMetadata": Object {
        "host": "$HOSTNAME",
        "index": "hyperledger_logs",
        "source": "fabric_logger",
      },
      "flushTime": 0,
      "gzip": true,
      "maxQueueEntries": -1,
      "maxQueueSize": 512000,
      "maxRetries": Infinity,
      "maxSockets": 128,
      "multipleMetricFormatEnabled": false,
      "requestKeepAlive": true,
      "retryWaitTime": [Function],
      "timeout": 30000,
      "token": undefined,
      "url": "https://undefined:undefined",
      "userAgent": "fabric_logger-hec-client/$VERSION",
      "validateCertificate": true,
      "waitForAvailability": 120000,
    },
    "events": undefined,
    "internal": Object {
      "defaultFields": Object {
        "nodeVersion": "$NODE_VERSION",
        "pid": "$PID",
        "version": "$VERSION",
      },
      "defaultMetadata": Object {
        "host": "$HOSTNAME",
        "source": "fabric_logger:internal",
        "sourcetype": "fabric_logger:internal",
      },
      "flushTime": 5000,
    },
    "metrics": undefined,
  },
  "output": Object {
    "sourceTypePrefix": "fabric_logger",
    "sourcetypes": Object {
      "block": "fabric_logger:block",
      "ccevent": "fabric_logger:ccevent",
      "config": "fabric_logger:config",
      "endorser_transaction": "fabric_logger:endorser_transaction",
      "nodeMetrics": "fabric:node:metrics",
    },
    "type": "hec",
  },
  "prometheus": Object {
    "defaultOptions": Object {
      "namePrefix": "fabric",
      "path": "/metrics",
      "port": "9090",
      "protocol": "http",
      "scrapeInterval": 10000,
      "scrapeOptions": Object {
        "allowCompression": undefined,
        "timeout": undefined,
        "userAgent": undefined,
        "validateCertificate": undefined,
        "validateContentType": undefined,
      },
    },
    "defaultOrdererOptions": Object {
      "path": undefined,
      "port": undefined,
    },
    "defaultPeerOptions": Object {
      "path": undefined,
      "port": undefined,
    },
    "discovery": false,
    "endpoints": Array [],
  },
}
`);
});

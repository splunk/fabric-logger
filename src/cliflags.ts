import { flags } from '@oclif/command';

export const CLI_FLAGS = {
    version: flags.version({ char: 'v' }),
    help: flags.help({ char: 'h' }),
    debug: flags.boolean({
        description: 'Enable debug log output',
    }),
    trace: flags.boolean({
        description:
            'Enable trace output (very, very verbose). ' +
            'Output will include raw payloads sent and received via JSON RPC and HEC',
        exclusive: ['debug'],
    }),
    'print-config': flags.boolean({
        description:
            'Causes fabriclogger to simply print the configuration merged from config file and CLI flags and exit.',
    }),
    'hec-url': flags.string({
        env: 'SPLUNK_HEC_URL',
        description:
            'URL to connect to Splunk HTTP Event Collector. ' +
            'You can either specify just the base URL (without path) ' +
            'and the default path will automatically appended or a full URL',
    }),
    'hec-token': flags.string({
        env: 'SPLUNK_HEC_TOKEN',
        description: 'Token to authenticate against Splunk HTTP Event Collector',
    }),
    'hec-events-index': flags.string({
        env: 'SPLUNK_INDEX',
        description:
            'Splunk index to send events to. You can alternatively use separate HEC tokens to correctly route your data',
    }),
    'hec-metrics-index': flags.string({
        env: 'SPLUNK_METRICS_INDEX',
        description:
            'Splunk index to send metrics to. You can alternatively use separate HEC tokens to correctly route your data',
    }),
    'hec-internal-index': flags.string({
        env: 'SPLUNK_INTERNAL_INDEX',
        description:
            'Splunk index to send internal metrics to. You can alternatively use separate HEC tokens to correctly route your data',
    }),
    'hec-events-token': flags.string({
        env: 'SPLUNK_EVENTS_HEC_TOKEN',
        description:
            'HEC token to use for sending events. You can alternatively configure different indexes to correctly route your data',
    }),
    'hec-metrics-token': flags.string({
        env: 'SPLUNK_METRICS_HEC_TOKEN',
        description:
            'HEC token to use for sending metrics. You can alternatively configure different indexes to correctly route your data',
    }),
    'hec-internal-token': flags.string({
        env: 'SPLUNK_INTERNAL_HEC_TOKEN',
        description:
            'HEC token to use for sending internal metrics. You can alternatively configure different indexes to correctly route your data',
    }),
    'hec-reject-invalid-certs': flags.boolean({
        allowNo: true,
        env: 'SPLUNK_HEC_REJECT_INVALID_CERTS',
        description:
            'Disable to allow HEC client to connect to HTTPS without rejecting invalid (self-signed) certificates',
    }),
    network: flags.string({
        env: 'NETWORK_CONFIG',
        description: 'Network configuration file',
    }),
    msp: flags.string({
        env: 'FABRIC_MSP',
        description: 'The name of the MSP that the user is enrolled in',
    }),
    user: flags.string({
        env: 'FABRIC_LOGGER_USERNAME',
        description: 'The username to use for fabric logger',
    }),
    'user-key': flags.string({
        env: 'FABRIC_KEYFILE',
        description: 'The private key for the user',
    }),
    'user-cert': flags.string({
        env: 'FABRIC_CERTFILE',
        description: 'The signed certificate from the fabric certificate authority',
    }),
    'client-key': flags.string({
        env: 'FABRIC_CLIENT_KEYFILE',
        description: 'The client private key used when mutual TLS is enabled to authenticate with the peer',
    }),
    'client-cert': flags.string({
        env: 'FABRIC_CLIENT_CERTFILE',
        description: 'The client certificate file used when mutual TLS is enabled to authenticate with the peer',
    }),
    'config-file': flags.string({
        env: 'FABRIC_LOGGER_CONFIG',
        char: 'c',
        description:
            'Fabriclogger configuration file to use. If not specified fabriclogger will look for a file ' +
            'called fabriclogger.yaml or fabriclogger.json in the current working directory',
    }),
    'splunk-host': flags.string({
        env: 'SPLUNK_HOST',
        description: 'DEPRECATED Hostname of splunk instance to send events to.',
    }),
    'splunk-port': flags.string({
        env: 'SPLUNK_PORT',
        description: 'DEPRECATED Port that splunk HEC is listening on to send',
    }),
    'block-type': flags.string({
        env: 'BLOCK_TYPE',
        description:
            'Type of block to subscribe to full or additionally include private data.  NOTE: private is not available and should not be used prior to fabric 2.X',
        options: ['full', 'private'],
    }),
    discovery: flags.boolean({
        env: 'FABRIC_DISCOVERY',
        description:
            'Indicates if peers and orderers should be discovered using the discovery service. If set to false only the network.yaml will be used.',
    }),
    'discovery-as-localhost': flags.boolean({
        env: 'FABRIC_DISCOVERY_AS_LOCALHOST',
        description:
            'Convert discovered host addresses to be localhost. Will be needed when running a docker composed fabric network on the local system; otherwise should be disabled.',
    }),
    'prometheus-discovery': flags.boolean({
        env: 'PROMETHEUS_DISCOVERY',
        description:
            'Indicates if Prometheus endpoints of peers and orderers should be discovered using the connection profile config. If set to false only the endpoints defined in fabriclogger.yml will be used.',
    }),
    'prometheus-scrape-interval': flags.string({
        env: 'PROMETHEUS_SCRAPE_INTERVAL',
        description: 'Time in seconds between Prometheus scrapes.',
    }),
    'prometheus-name-prefix': flags.string({
        env: 'PROMETHEUS_NAME_PREFIX',
        description: 'A common prefix for all Prometheus metrics emitted to Splunk.',
    }),
    'prometheus-port': flags.string({
        env: 'PROMETHEUS_PORT',
        description: 'Default port to use when scraping Prometheus metrics.',
    }),
    'prometheus-path': flags.string({
        env: 'PROMETHEUS_PATH',
        description: 'Default URL path to use when scraping Prometheus metrics.',
    }),
    'prometheus-protocol': flags.string({
        env: 'PROMETHEUS_PROTOCOL',
        description: 'Default protocol to use when scraping Prometheus metrics.',
    }),
    'prometheus-peer-port': flags.string({
        env: 'PROMETHEUS_PEER_PORT',
        description:
            'Default port to try for discovered peers when scraping Prometheus metrics (overrides PROMETHEUS_PORT).',
    }),
    'prometheus-orderer-port': flags.string({
        env: 'PROMETHEUS_ORDERER_PORT',
        description:
            'Default port to try for discovered orderers when scraping Prometheus metrics (overrides PROMETHEUS_PORT).',
    }),
    'prometheus-peer-path': flags.string({
        env: 'PROMETHEUS_PEER_PATH',
        description:
            'Default path to try for discovered peers when scraping Prometheus metrics (overrides PROMETHEUS_PATH).',
    }),
    'prometheus-orderer-path': flags.string({
        env: 'PROMETHEUS_ORDERER_PATH',
        description:
            'Default path to try for discovered orderers when scraping Prometheus metrics (overrides PROMETHEUS_PATH).',
    }),
};

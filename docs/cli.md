# Splunk Connect for Hyperledger Fabric (fabriclogger) CLI

The fabriclogger CLI tool is used to start and configure connections to the fabric network and outputs. Command line flags or environment variables can be used to configure the CLI. Fine grained configuration options are available using the [config file](configuration.md). Note that CLI flags will take precedence over environment variables which, in turn, take precedence over configuration files.

## CLI Flags Reference

<!-- CLIREF -->

```
Splunk Connect for Hyperledger Fabric

USAGE
  $ fabriclogger

OPTIONS
  -c, --config-file=config-file
      Fabriclogger configuration file to use. If not specified fabriclogger will
      look for a file called fabriclogger.yaml or fabriclogger.json in the current
      working directory

  -h, --help
      show CLI help

  -v, --version
      show CLI version

  --block-type=full|private
      Type of block to subscribe to full or additionally include private data.
      NOTE: private is not available and should not be used prior to fabric 2.X

  --client-cert=client-cert
      The client certificate file used when mutual TLS is enabled to authenticate
      with the peer

  --client-key=client-key
      The client private key used when mutual TLS is enabled to authenticate with
      the peer

  --debug
      Enable debug log output

  --discovery
      Indicates if peers and orderers should be discovered using the discovery
      service. If set to false only the network.yaml will be used.

  --discovery-as-localhost
      Convert discovered host addresses to be localhost. Will be needed when
      running a docker composed fabric network on the local system; otherwise
      should be disabled.

  --hec-events-index=hec-events-index
      Splunk index to send events to. You can alternatively use separate HEC
      tokens to correctly route your data

  --hec-events-token=hec-events-token
      HEC token to use for sending events. You can alternatively configure
      different indexes to correctly route your data

  --hec-internal-index=hec-internal-index
      Splunk index to send internal metrics to. You can alternatively use separate
      HEC tokens to correctly route your data

  --hec-internal-token=hec-internal-token
      HEC token to use for sending internal metrics. You can alternatively
      configure different indexes to correctly route your data

  --hec-metrics-index=hec-metrics-index
      Splunk index to send metrics to. You can alternatively use separate HEC
      tokens to correctly route your data

  --hec-metrics-token=hec-metrics-token
      HEC token to use for sending metrics. You can alternatively configure
      different indexes to correctly route your data

  --[no-]hec-reject-invalid-certs
      Disable to allow HEC client to connect to HTTPS without rejecting invalid
      (self-signed) certificates

  --hec-token=hec-token
      Token to authenticate against Splunk HTTP Event Collector

  --hec-url=hec-url
      URL to connect to Splunk HTTP Event Collector. You can either specify just
      the base URL (without path) and the default path will automatically appended
      or a full URL

  --msp=msp
      The name of the MSP that the user is enrolled in

  --network=network
      Network configuration file

  --print-config
      Causes fabriclogger to simply print the configuration merged from config
      file and CLI flags and exit.

  --prometheus-discovery
      Indicates if Prometheus endpoints of peers and orderers should be discovered
      using the connection profile config. If set to false only the endpoints
      defined in fabriclogger.yml will be used.

  --prometheus-name-prefix=prometheus-name-prefix
      A common prefix for all Prometheus metrics emitted to Splunk.

  --prometheus-orderer-path=prometheus-orderer-path
      Default path to try for discovered orderers when scraping Prometheus metrics
      (overrides PROMETHEUS_PATH).

  --prometheus-orderer-port=prometheus-orderer-port
      Default port to try for discovered orderers when scraping Prometheus metrics
      (overrides PROMETHEUS_PORT).

  --prometheus-path=prometheus-path
      Default URL path to use when scraping Prometheus metrics.

  --prometheus-peer-path=prometheus-peer-path
      Default path to try for discovered peers when scraping Prometheus metrics
      (overrides PROMETHEUS_PATH).

  --prometheus-peer-port=prometheus-peer-port
      Default port to try for discovered peers when scraping Prometheus metrics
      (overrides PROMETHEUS_PORT).

  --prometheus-port=prometheus-port
      Default port to use when scraping Prometheus metrics.

  --prometheus-protocol=prometheus-protocol
      Default protocol to use when scraping Prometheus metrics.

  --prometheus-scrape-interval=prometheus-scrape-interval
      Time in seconds between Prometheus scrapes.

  --splunk-host=splunk-host
      DEPRECATED Hostname of splunk instance to send events to.

  --splunk-port=splunk-port
      DEPRECATED Port that splunk HEC is listening on to send

  --trace
      Enable trace output (very, very verbose). Output will include raw payloads
      sent and received via JSON RPC and HEC

  --user=user
      The username to use for fabric logger

  --user-cert=user-cert
      The signed certificate from the fabric certificate authority

  --user-key=user-key
      The private key for the user
```

<!-- CLIREF-END -->

## Environment Variables

<!-- ENVREF -->

| Environment Variable              | Type      | Description                                                                                                                                                                                    |
| --------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SPLUNK_HEC_URL`                  | `string`  | URL to connect to Splunk HTTP Event Collector. You can either specify just the base URL (without path) and the default path will automatically appended or a full URL                          |
| `SPLUNK_HEC_TOKEN`                | `string`  | Token to authenticate against Splunk HTTP Event Collector                                                                                                                                      |
| `SPLUNK_INDEX`                    | `string`  | Splunk index to send events to. You can alternatively use separate HEC tokens to correctly route your data                                                                                     |
| `SPLUNK_METRICS_INDEX`            | `string`  | Splunk index to send metrics to. You can alternatively use separate HEC tokens to correctly route your data                                                                                    |
| `SPLUNK_INTERNAL_INDEX`           | `string`  | Splunk index to send internal metrics to. You can alternatively use separate HEC tokens to correctly route your data                                                                           |
| `SPLUNK_EVENTS_HEC_TOKEN`         | `string`  | HEC token to use for sending events. You can alternatively configure different indexes to correctly route your data                                                                            |
| `SPLUNK_METRICS_HEC_TOKEN`        | `string`  | HEC token to use for sending metrics. You can alternatively configure different indexes to correctly route your data                                                                           |
| `SPLUNK_INTERNAL_HEC_TOKEN`       | `string`  | HEC token to use for sending internal metrics. You can alternatively configure different indexes to correctly route your data                                                                  |
| `SPLUNK_HEC_REJECT_INVALID_CERTS` | `boolean` | Disable to allow HEC client to connect to HTTPS without rejecting invalid (self-signed) certificates                                                                                           |
| `NETWORK_CONFIG`                  | `string`  | Network configuration file                                                                                                                                                                     |
| `FABRIC_MSP`                      | `string`  | The name of the MSP that the user is enrolled in                                                                                                                                               |
| `FABRIC_LOGGER_USERNAME`          | `string`  | The username to use for fabric logger                                                                                                                                                          |
| `FABRIC_KEYFILE`                  | `string`  | The private key for the user                                                                                                                                                                   |
| `FABRIC_CERTFILE`                 | `string`  | The signed certificate from the fabric certificate authority                                                                                                                                   |
| `FABRIC_CLIENT_KEYFILE`           | `string`  | The client private key used when mutual TLS is enabled to authenticate with the peer                                                                                                           |
| `FABRIC_CLIENT_CERTFILE`          | `string`  | The client certificate file used when mutual TLS is enabled to authenticate with the peer                                                                                                      |
| `FABRIC_LOGGER_CONFIG`            | `string`  | Fabriclogger configuration file to use. If not specified fabriclogger will look for a file called fabriclogger.yaml or fabriclogger.json in the current working directory                      |
| `SPLUNK_HOST`                     | `string`  | DEPRECATED Hostname of splunk instance to send events to.                                                                                                                                      |
| `SPLUNK_PORT`                     | `string`  | DEPRECATED Port that splunk HEC is listening on to send                                                                                                                                        |
| `BLOCK_TYPE`                      | `string`  | Type of block to subscribe to full or additionally include private data. NOTE: private is not available and should not be used prior to fabric 2.X                                             |
| `FABRIC_DISCOVERY`                | `boolean` | Indicates if peers and orderers should be discovered using the discovery service. If set to false only the network.yaml will be used.                                                          |
| `FABRIC_DISCOVERY_AS_LOCALHOST`   | `boolean` | Convert discovered host addresses to be localhost. Will be needed when running a docker composed fabric network on the local system; otherwise should be disabled.                             |
| `PROMETHEUS_DISCOVERY`            | `boolean` | Indicates if Prometheus endpoints of peers and orderers should be discovered using the connection profile config. If set to false only the endpoints defined in fabriclogger.yml will be used. |
| `PROMETHEUS_SCRAPE_INTERVAL`      | `string`  | Time in seconds between Prometheus scrapes.                                                                                                                                                    |
| `PROMETHEUS_NAME_PREFIX`          | `string`  | A common prefix for all Prometheus metrics emitted to Splunk.                                                                                                                                  |
| `PROMETHEUS_PORT`                 | `string`  | Default port to use when scraping Prometheus metrics.                                                                                                                                          |
| `PROMETHEUS_PATH`                 | `string`  | Default URL path to use when scraping Prometheus metrics.                                                                                                                                      |
| `PROMETHEUS_PROTOCOL`             | `string`  | Default protocol to use when scraping Prometheus metrics.                                                                                                                                      |
| `PROMETHEUS_PEER_PORT`            | `string`  | Default port to try for discovered peers when scraping Prometheus metrics (overrides PROMETHEUS_PORT).                                                                                         |
| `PROMETHEUS_ORDERER_PORT`         | `string`  | Default port to try for discovered orderers when scraping Prometheus metrics (overrides PROMETHEUS_PORT).                                                                                      |
| `PROMETHEUS_PEER_PATH`            | `string`  | Default path to try for discovered peers when scraping Prometheus metrics (overrides PROMETHEUS_PATH).                                                                                         |
| `PROMETHEUS_ORDERER_PATH`         | `string`  | Default path to try for discovered orderers when scraping Prometheus metrics (overrides PROMETHEUS_PATH).                                                                                      |

<!-- ENVREF-END -->

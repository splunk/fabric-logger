# Fabriclogger Configuration

For fine-grained control over fabriclogger's operation you can create a configuration file and tweak any of the settings available. Some settings can also be adjusted using [CLI flags](./cli.md#cli-flags-reference) or [environment variables](./cli.md#environment-variables) (CLI flags and environment variables do take precedence over settings in the configuration, if specified).

The configuration file can be created either in `YAML` or in `JSON` format. You can specify the configuration file path using the `--config-file` (short `-c`) CLI flag:

```sh-session
$ fabriclogger -c path/to/myconfig.yaml
```

or, if omitted, fabriclogger will look for a file called `fabriclogger.yaml` in the current working directory. If this file is not present either, then fabriclogger will go with the [default configuration](../defaults.fabriclogger.yaml).

The configuration file content will be layered on top of the [defaults](../fabriclogger.defaults.yaml), so it is only necessary to specify settings where the default needs to be overridden.

## Example

`fabriclogger.yaml`

<!-- EXAMPLE -->

```yaml
fabric:
    networkConfig: network.yaml
    user: fabric-logger
    keyFile: 'test/fixtures/testkey'
    certFile: 'test/fixtures/testcert'
    msp: 'msp'
    channels:
        - myChannel
    ccevents:
        - channelName: myChannel
          chaincodeId: myChaincodeId
prometheus:
    discovery: true
    peerPort: '7081'
    ordererPort: '7080'
output:
    type: hec
    sourceTypePrefix: 'fabric_logger'
hec:
    default:
        url: https://localhost:8088
        token: 44422111-0000-3232-9821-26664c2e7515
        validateCertificate: false
        # Splunk 8.0 or higher support compact metrics HEC messages
        multipleMetricFormatEnabled: true
    events:
        defaultMetadata:
            index: myevents
    metrics:
        defaultMetadata:
            index: mymetrics
```

<!-- EXAMPLE-END -->

## Debugging Fabriclogger Configuration

Fabriclogger has a dedicated flag `--print-config` to show the effective configuration after merging defaults, config file, environment variables and CLI flags.

```sh-session
$ fabriclogger -c myconfig.yaml --print-config
```

## JSON Schema

You can find a [JSON Schema](https://json-schema.org) for fabriclogger's configuration files here: [config.schema.json](../config.schema.json).

### Editor Integrations

Several editors can use JSON schemas to provide validation and auto-complete as you edit the config file.

-   JSON schemas in VS Code: https://code.visualstudio.com/docs/languages/json#_json-schemas-and-settings
-   https://json-schema.org/implementations.html#editors

## Reference

<!-- REFERENCE -->

### Fabriclogger

| Name         | Type                                                                                                                               | Description                                                                                                                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkpoint` | [`Checkpoint`](#Checkpoint)                                                                                                        | Checkpoint configuration - how fabriclogger keeps track of state between restarts                                                                                                                             |
| `fabric`     | [`Fabric`](#Fabric)                                                                                                                | Fabric configuration                                                                                                                                                                                          |
| `hec`        | [`HecClients`](#HecClients)                                                                                                        | HTTP event collector                                                                                                                                                                                          |
| `prometheus` | [`Prometheus`](#Prometheus)                                                                                                        | Prometheus Scraper Configuration                                                                                                                                                                              |
| `output`     | [`HecOutput`](#HecOutput) \| [`ConsoleOutput`](#ConsoleOutput) \| [`FileOutput`](#FileOutput) \| [`DevNullOutput`](#DevNullOutput) | In the output configuration you can specify where fabriclogger will send generated events to. By default it will send all information to Splunk HEC, but you can instead send it to console output or a file. |

### Checkpoint

The checkpoint is where fabriclogger keeps track of its state, which blocks have already been processed. This allows it to resume where it left off after being shut down and restarted.

| Name           | Type                    | Description                                                                                    | Default        |
| -------------- | ----------------------- | ---------------------------------------------------------------------------------------------- | -------------- |
| `filename`     | `string`                | File path (relative to the current working directory) where the checkpoint file will be stored | `.checkpoints` |
| `saveInterval` | [`Duration`](#Duration) | Maximum duration before saving updated checkpoint information to disk                          |                |

### Fabric

| Name             | Type                                    | Description                                                                               |
| ---------------- | --------------------------------------- | ----------------------------------------------------------------------------------------- |
| `msp`            | `string`                                | The name of the MSP that the user is enrolled in                                          |
| `networkConfig`  | `string`                                | Network configuration file                                                                |
| `user`           | `string`                                | The username to use for fabric logger                                                     |
| `keyFile`        | `string`                                | The private key for the user                                                              |
| `certFile`       | `string`                                | The signed certificate from the fabric certificate authority                              |
| `clientCertFile` | `string`                                | The client certificate file used when mutual TLS is enabled to authenticate with the peer |
| `clientKeyFile`  | `string`                                | The client private key used when mutual TLS is enabled to authenticate with the peer      |
| `channels`       | Array<`string`>                         | Channels to listen to                                                                     |
| `ccevents`       | Array<[`CCEvent`](#CCEvent)>            | Chaincode events to listen to                                                             |
| `blockType`      | `"filtered"` \| `"full"` \| `"private"` | Block Type full or private                                                                |
| `discovery`      | `boolean`                               | Enable Discovery service                                                                  |
| `asLocalHost`    | `boolean`                               | Convert discovered addresses to localhost for docker                                      |

### CCEvent

Chaincode event to listen to

| Name          | Type     | Description  |
| ------------- | -------- | ------------ |
| `channelName` | `string` | channel name |
| `chaincodeId` | `string` | chaincodeid  |
| `block`       | `number` | block        |

### HecClients

| Name       | Type          | Description                                                                                                                                                                                                |
| ---------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default`  | [`Hec`](#Hec) | Base settings that apply to all HEC clients. Overrides for events, metrics and internal metrics will be layered on top of the defaults and allow for using different HEC tokens, URL or destination index. |
| `events`   | [`Hec`](#Hec) | HEC settings (overrides for `default`) for events sent to Splunk                                                                                                                                           |
| `metrics`  | [`Hec`](#Hec) | HEC settings (overrides for `default`) for metrics sent to Splunk                                                                                                                                          |
| `internal` | [`Hec`](#Hec) | HEC settings (overrides for `default`) for internal metrics sent to Splunk                                                                                                                                 |

### Hec

Settings for the Splunk HTTP Event Collector client

| Name                          | Type                    | Description                                                                                                                                                                                                                                                                                                              | Default                             |
| ----------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| `url`                         | `string`                | The URL of HEC. If only the base URL is specified (path is omitted) then the default path will be used                                                                                                                                                                                                                   |                                     |
| `token`                       | `string`                | The HEC token used to authenticate HTTP requests                                                                                                                                                                                                                                                                         |                                     |
| `defaultMetadata`             | `object`                | Defaults for host, source, sourcetype and index. Can be overridden for each message<br><br>See [Use variables in metadata](#metadata-variables)                                                                                                                                                                          |                                     |
| `defaultFields`               | `object`                | Default set of fields to apply to all events and metrics sent with this HEC client<br><br>See [Use variables in metadata](#metadata-variables)                                                                                                                                                                           |                                     |
| `maxQueueEntries`             | `number`                | Maximum number of entries in the HEC message queue before flushing it                                                                                                                                                                                                                                                    |                                     |
| `maxQueueSize`                | `number`                | Maximum number of bytes in the HEC message queue before flushing it                                                                                                                                                                                                                                                      |                                     |
| `flushTime`                   | [`Duration`](#Duration) | Maximum number of milliseconds to wait before flushing the HEC message queue                                                                                                                                                                                                                                             |                                     |
| `gzip`                        | `boolean`               | Gzip compress the request body sent to HEC (Content-Encoding: gzip)                                                                                                                                                                                                                                                      |                                     |
| `maxRetries`                  | `number`                | Maximum number of attempts to send a batch to HEC. By default this there is no limit                                                                                                                                                                                                                                     |                                     |
| `timeout`                     | [`Duration`](#Duration) | Number of milliseconds to wait before considering an HTTP request as failed                                                                                                                                                                                                                                              |                                     |
| `requestKeepAlive`            | `boolean`               | Set to `false` to disable HTTP keep-alive for connections to Splunk                                                                                                                                                                                                                                                      |                                     |
| `validateCertificate`         | `boolean`               | If set to false, the HTTP client will ignore certificate errors (eg. when using self-signed certs)                                                                                                                                                                                                                       |                                     |
| `maxSockets`                  | `number`                | Maximum number of sockets HEC will use (per host)                                                                                                                                                                                                                                                                        |                                     |
| `userAgent`                   | `string`                | User-agent header sent to HEC<br><br>See [Use variables in metadata](#metadata-variables)                                                                                                                                                                                                                                | `fabriclogger-hec-client/<version>` |
| `retryWaitTime`               | [`WaitTime`](#WaitTime) | Wait time before retrying to send a (batch of) HEC messages after an error                                                                                                                                                                                                                                               |                                     |
| `multipleMetricFormatEnabled` | `boolean`               | Enable sending multiple metrics in a single message to HEC. Supported as of Splunk 8.0.0<br><br>https://docs.splunk.com/Documentation/Splunk/8.0.0/Metrics/GetMetricsInOther#The_multiple-metric_JSON_format                                                                                                             |                                     |
| `waitForAvailability`         | [`Duration`](#Duration) | If set to > 0, then fabriclogger will wait for the HEC service to become available for the given amount of time by periodically attempting to request the collector/health REST endpoint. This can be useful when starting Splunk and fabriclogger for example in docker-compose, where Splunk takes some time to start. |                                     |

### PrometheusScraper

| Name                  | Type                    | Description                                                                                              |
| --------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------- |
| `scrapeInterval`      | [`Duration`](#Duration) | Time between scrapes of Prometheus endpoints.                                                            |
| `path`                | `string`                | URL path to use when scraping Prometheus metrics                                                         |
| `protocol`            | `string`                | Protocol to use when scraping Prometheus metrics                                                         |
| `port`                | `string`                | Port to use when scraping Prometheus metrics.                                                            |
| `timeout`             | `number`                | Request timeout                                                                                          |
| `allowCompression`    | `boolean`               | If not disabled, this will allow the prometheus server to respond with compressed body (gzip or deflate) |
| `validateContentType` | `boolean`               | If set to false, the scraper will not check the content type of the response from the server             |
| `validateCertificate` | `boolean`               | If set to false, the HTTP client will ignore certificate errors (eg. when using self-signed certs)       |
| `userAgent`           | `string`                | User-agent header sent to metrics endpoint                                                               |

### Prometheus

| Name                  | Type                                               | Description                                                                                              |
| --------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `scrapeInterval`      | [`Duration`](#Duration)                            | Time between scrapes of Prometheus endpoints.                                                            |
| `path`                | `string`                                           | URL path to use when scraping Prometheus metrics                                                         |
| `protocol`            | `string`                                           | Protocol to use when scraping Prometheus metrics                                                         |
| `port`                | `string`                                           | Port to use when scraping Prometheus metrics.                                                            |
| `timeout`             | `number`                                           | Request timeout                                                                                          |
| `allowCompression`    | `boolean`                                          | If not disabled, this will allow the prometheus server to respond with compressed body (gzip or deflate) |
| `validateContentType` | `boolean`                                          | If set to false, the scraper will not check the content type of the response from the server             |
| `validateCertificate` | `boolean`                                          | If set to false, the HTTP client will ignore certificate errors (eg. when using self-signed certs)       |
| `userAgent`           | `string`                                           | User-agent header sent to metrics endpoint                                                               |
| `discovery`           | `boolean`                                          | Enable prometheus endpoint discovery.                                                                    |
| `namePrefix`          | `string`                                           | A common prefix for all Prometheus metrics emitted to Splunk                                             |
| `peerPort`            | `string`                                           | Default port to try for discovered peers (overrides port).                                               |
| `peerPath`            | `string`                                           | Default path to try for discovered peers (overrides path).                                               |
| `ordererPort`         | `string`                                           | Default port to try for discovered orderers (overrides port).                                            |
| `ordererPath`         | `string`                                           | Default path to try for discovered orderers (overrides path).                                            |
| `endpoints`           | Array<[`PrometheusEndpoint`](#PrometheusEndpoint)> | Prometheus endpoints to scrape                                                                           |

### PrometheusEndpoint

| Name                  | Type                    | Description                                                                                              |
| --------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------- |
| `scrapeInterval`      | [`Duration`](#Duration) | Time between scrapes of Prometheus endpoints.                                                            |
| `path`                | `string`                | URL path to use when scraping Prometheus metrics                                                         |
| `protocol`            | `string`                | Protocol to use when scraping Prometheus metrics                                                         |
| `port`                | `string`                | Port to use when scraping Prometheus metrics.                                                            |
| `timeout`             | `number`                | Request timeout                                                                                          |
| `allowCompression`    | `boolean`               | If not disabled, this will allow the prometheus server to respond with compressed body (gzip or deflate) |
| `validateContentType` | `boolean`               | If set to false, the scraper will not check the content type of the response from the server             |
| `validateCertificate` | `boolean`               | If set to false, the HTTP client will ignore certificate errors (eg. when using self-signed certs)       |
| `userAgent`           | `string`                | User-agent header sent to metrics endpoint                                                               |
| `url`                 | `string`                | Full URL to scrape for Prometheus metrics                                                                |

### HecOutput

| Name               | Type                          | Description                                                        |
| ------------------ | ----------------------------- | ------------------------------------------------------------------ |
| `type`             | `"hec"`                       |                                                                    |
| `sourceTypePrefix` | `string`                      | A common prefix for all unknown events emitted to Splunk           |
| `sourcetypes`      | [`Sourcetypes`](#Sourcetypes) | Sourcetypes to use for different kinds of events we send to Splunk |

### Sourcetypes

Configurable set of `sourcetype` field values emitted by fabriclogger

| Name                   | Type     | Default                                |
| ---------------------- | -------- | -------------------------------------- |
| `block`                | `string` | `"fabric_logger:block"`                |
| `endorser_transaction` | `string` | `"fabric_logger:endorser_transaction"` |
| `ccevent`              | `string` | `"fabric_logger:ccevent"`              |
| `config`               | `string` | `"fabric_logger:config"`               |
| `nodeMetrics`          | `string` | `"fabric:node:metrics"`                |

### ConsoleOutput

Console output prints all generated events and metrics to STDOUT

| Name   | Type        |
| ------ | ----------- |
| `type` | `"console"` |

### FileOutput

File output will append all generated messages to a file. (this output type has not been implemented)

| Name   | Type     | Description         |
| ------ | -------- | ------------------- |
| `type` | `"file"` |                     |
| `path` | `string` | Path to output file |

### DevNullOutput

Null output will just drop all generated events and metrics

| Name   | Type     |
| ------ | -------- |
| `type` | `"null"` |

<!-- REFERENCE-END -->

### Duration

A duration in fabriclogger's config can be specified either as as a `number` or a `string`.

| Type     | Description                                                                    | Examples               |
| -------- | ------------------------------------------------------------------------------ | ---------------------- |
| `number` | Number of milliseconds                                                         | `500`                  |
| `string` | Golang-style duration string<br>See https://golang.org/pkg/time/#ParseDuration | `"1h"`, `"3m30s500ms"` |

### WaitTime

Wait time expresses how long to wait between retry attempts based on the number of attempts made so far.

| Type                                        | Description                                         |
| ------------------------------------------- | --------------------------------------------------- |
| [`Duration`](#Duration)                     | Absolute and static time to wait after each attempt |
| [`ExponentialBackoff`](#ExponentialBackoff) | Exponentially increasing wait time with randomness  |
| [`LinearBackoff`](#LinearBackoff)           | Linear increasing wait time                         |

### ExponentialBackoff

Exponentially increasing wait time with randomness. The wait time will be a random number between `min` and 2<sup>attempts</sup> (up to `max`) after each attempt.

| Name   | Type                    | Description       |
| ------ | ----------------------- | ----------------- |
| `type` | `"exponential-backoff"` |                   |
| `min`  | [`Duration`](#Duration) | Minimum wait time |
| `max`  | [`Duration`](#Duration) | Maximum wait time |

**Example**

```json
{ "type": "exponential-backoff", "min": 0, "max": "5m" }
```

### LinearBackoff

Linear increasing wait time

| Name   | Type                    | Description                                                                 |
| ------ | ----------------------- | --------------------------------------------------------------------------- |
| `type` | `"linear-backoff"`      |                                                                             |
| `min`  | [`Duration`](#Duration) | Minimum wait time (after the first failure)                                 |
| `step` | [`Duration`](#Duration) | Increase of wait time for each failure after the first until max is reached |
| `max`  | [`Duration`](#Duration) | Maximum wait time                                                           |

**Example**

```json
{ "type": "linear-backoff", "min": 0, "step": "30s", "max": "5m" }
```

### Metadata Variables

Fabriclogger supports a set of variables you can use in metadata sent to Splunk (host, sourcetype, source and other fields). Those variables will be automatically substituted. Below is a list of variables available:

<!-- METAVARIABLES -->

| Variable        | Description                                        |
| --------------- | -------------------------------------------------- |
| `$HOSTNAME`     | Hostname of the machine fabriclogger is running on |
| `$PID`          | The fabriclogger PID                               |
| `$VERSION`      | Fabriclogger version                               |
| `$NODE_VERSION` | The node.js version fabriclogger is running on     |

<!-- METAVARIABLES-END -->

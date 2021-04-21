# Prometheus metrics with Splunk OpenTelemetry Connector example

This example uses [minifab](https://github.com/hyperledger-labs/minifabric).

This example targets Hyperledger 2.2.

NOTE: Docker for Mac requires to run with the legacy osxfs file sharing mechanism. Please see [this issue](https://github.com/hyperledger-labs/minifabric/issues/141) for more information.

This example builds on the [minifab](../minifab) example, adding Prometheus metrics collection with the OpenTelemetry collector.

## Start the example

Make sure Docker and docker-compose are installed.

```bash
$> ./start.sh
```

# Access Splunk

Splunk runs as part of the deployment on your machine, and is available at `https://localhost:8000`.

You can log in with `admin/changeme`. Splunk installs the Hyperledger Fabric application, from which you can explore your setup.

## Exploring metrics

You can explore metrics in the metrics tab of the Hyperledger Fabric application.

The OpenTelemetry collector is [configured](./otel-collector-config.yml) to collect from all peers and orderers of the network.

## Stopping the sample

When done, make sure to stop the network. The following script will remove all containers, their volumes and images.

```bash
$> ./stop.sh
```

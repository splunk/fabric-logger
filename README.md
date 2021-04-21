# Splunk Connect for Hyperledger Fabric

The Splunk Connect for Hyperledger Fabric sends blocks and transactions from a Hyperledger Fabric distributed ledger to Splunk for analytics. It's recommended (but not required) that this is used with Splunk App for Hyperledger Fabric. This app can also send blocks and transactions to stdout with use for any other system.

Currently the fabric-logger supports connecting to 1 peer at a time, so you will have to deploy multiple instances of the fabric-logger for each peer that you want to connect to. Each fabric-logger instance can monitor multiple channels for the peer it is connected to.

## Fabric ACLs Required for Splunk Connect for Hyperledger Fabric

User authentication in Hyperledger Fabric depends on a private key and a signed certificate. If using the `cryptogen` tool, these files will be found in the following directories (see also `helm-chart/fabric-logger/templates/secret.yaml`):

-   Signed Certificate: `crypto-config/peerOrganizations/<org-domain>/users/<username>@<org-domain>/msp/signcerts/<username>@<org-domain>-cert.pem`
-   Private Key: `crypto-config/peerOrganizations/<org-domain>/users/<username>@<org-domain>/msp/keystore/*_sk`

Additionally, Hyperledger Fabric users depend on ACLs defined in the `configtx.yaml` file in order to listen for events on peers. You can see all the ACLs documented [here](https://github.com/hyperledger/fabric/blob/309194182870aebc1e5faf153ea9e4aabda25b8e/sampleconfig/configtx.yaml#L144). The only required ACL policy for using this app is `event/Block`, by default this is mapped to the policy `/Channel/Application/Readers`. Any user defined under this policy in the organization can be used for the fabric-logger. User membership into policies are defined at the organization level, an example can be seen [here](https://github.com/hyperledger/fabric/blob/309194182870aebc1e5faf153ea9e4aabda25b8e/sampleconfig/configtx.yaml#L38).

## Configuration

Fabric Logger uses two files for configuration:

Connection profile `network.yaml` with the appropriate values.

`fabriclogger.yaml` which Fabric Logger uses for defining channels, peer, chaincode events etc to listen to.

Refer to the [configuration docs](./docs/configuration.md) and [fabriclogger.yaml.example](./fabriclogger.yaml.example) for how to setup.

## Checkpoints

As Fabric Logger processes blocks and chaincode events the progress is stored in a `.checkpoints` file. Upon restart Fabric Logger will load this file and resume from the last processed block number. The file uses ini format. Sample below:

```
myChannel=5
mySecondChannel=3

[ccevents.myChannel_myChaincodeId]
channelName=myChannel
chaincodeId=myChaincodeId
block=5
```

## Running in Docker

Running the Fabric Logger in Docker is recommended. A sample docker-compose entry looks as follows:

    services:
        fabric-logger.example.com:
            container_name: fabric-logger.example.com
            image: ghcr.io/splunkdlt/fabric-logger:latest
            environment:
                - FABRIC_KEYFILE=<path to private key file>
                - FABRIC_CERTFILE=<path to signed certificate>
                - FABRIC_CLIENT_CERTFILE=<path to client certificate when using mutual tls>
                - FABRIC_CLIENT_KEYFILE=<path to client private key when using mutual tls>
                - FABRIC_MSP=<msp name>
                - SPLUNK_HEC_TOKEN=12345678-ABCD-EFGH-IJKL-123456789012
                - SPLUNK_HEC_URL=https://splunk.example.com:8088
                - SPLUNK_HEC_REJECT_INVALID_CERTS="false"
                - SPLUNK_INDEX=hyperledger_logs
                - SPLUNK_METRICS_INDEX=hyperledger_metrics
                - LOGGING_LOCATION=splunk
                - NETWORK_CONFIG=network.yaml
                - PROMETHEUS_DISCOVERY=true
                - PROMETHEUS_ORDERER_PORT=7060
                - PROMETHEUS_PEER_PORT=7061
            volumes:
                - ./crypto:/usr/src/app/crypto/
                - ./network.yaml:/usr/src/app/network.yaml
                - ./fabriclogger.yaml:/usr/src/app/fabriclogger.yaml
                - ./.checkpoints:/usr/src/app/.checkpoints
            depends_on:
                - orderer.example.com
                - peer0.example.com
                - peer1.example.com
            ports:
                8080:8080
            networks:
                - hlf_network

## Running in Kubernetes

We also include a helm chart for Kubernetes deployments. First set your `values.yaml` file. Here is an example configuration (although this will be specific to your environment):

    splunk:
        hec:
            token: 12345678-ABCD-EFGH-IJKL-123456789012
            url: https://splunk-splunk-kube.splunk.svc.cluster.local:8088
            rejectInvalidCerts: "false"
        index: hyperledger_logs

    secrets:
        peer:
          cert: hlf--peer-admincert
          # itemKey can be defined if there is a secret with multiple items stored inside.
          certItem: cert.pem
          key: hlf--peer-adminkey
          keyItem: key.pem
          tls: hlf--peer-tlscert
          tlsItem: tlscacert.pem
          clientCert: hlf--peer-clientcert
          clientCertItem: clientCert.pem
          clientKey: hlf--peer-clientkey
          clientKeyItem: clientKey.pem

    fabric:
        msp: PeerMSP
        orgDomain: example.com
        blockType: full
        user: Admin
        channels:
            - channel1
            - channel2
        ccevents:
            - channelName: channel1
              chaincodeId: myChaincodeId
            - channelName: channel1
              chaincodeId: myChaincodeId

### Kubernetes: Autogenerating Secrets

Alternatively, if you are using `cryptogen` to generate identities, the helm chart can auto-populate secrets for you. You will need to download the helm file and untar it locally so you can copy your `crypto-config` into the director.

    wget https://github.com/splunk/fabric-logger/releases/download/v4.2.2/fabric-logger-helm-4.2.2.tgz
    tar -xf fabric-logger-helm-4.2.2.tgz
    cp -R crypto-config fabric-logger/crypto-config

Set the secrets section of `values.yaml` to:

    secrets:
        peer:
            create: true

You can now deploy using:

    helm install -n fabric-logger-${NS} --namespace ${NS} \
                 -f values.yaml -f network.yaml ./fabric-logger

### Kubernetes: Manually Populating Secrets

Make sure that the peer credentials are stored in the appropriately named secrets in the same namespace. It's not required to use the admin credential for connecting, just make sure to select the appropriate user for your use case.

    NS=default
    ADMIN_MSP_DIR=./crypto-config/peerOrganizations/peer0.example.com/users/Admin@peer0.example.com/msp

    CERT=$(find ${ADMIN_MSP_DIR}/signcerts/*.pem -type f)
    kubectl create secret generic -n ${NS} hlf-peer--peer0-cert --from-file=cert.pem=$CERT

    KEY=$(find ${ADMIN_MSP_DIR}/keystore/*_sk -type f)
    kubectl create secret generic -n ${NS} hlf-peer--peer0-key --from-file=key.pem=$KEY

A `network.yaml` configmap will automatically be generated using the secrets and channel details set above. You can deploy via helm:

    helm install -n fabric-logger-${PEER_NAME}-${NS} --namespace ${NS} \
                 -f https://raw.githubusercontent.com/splunk/fabric-logger/master/defaults.fabriclogger.yaml \
                 -f values.yaml -f network.yaml \
                 https://github.com/splunk/fabric-logger/releases/download/v4.2.2/fabric-logger-helm-4.2.2.tgz

### Kubernetes: Deleting Helm Chart

    helm delete --purge fabric-logger-${PEER_NAME}-${NS}

## Running Locally

1.  Install dependencies:

        $ yarn install

2.  Configuration:

fabric-logger requires some configuration to connect to your blockchain. You will need to provide a configuration file fabriclogger.yaml or set the appropriate environment variables. Details about fabriclogger's command-line usage in the [CLI docs](./docs/cli.md)

You will also need to update the `network.yaml` with appropriate values for you system.

3.  Start the application:

        $ yarn start

## Examples

1. [Basic Minifab](./examples/minifab/README.md)
2. [Prometheus Metrics (scraped by fabric-logger)](./examples/prometheus-scraper/README.md)
3. [Prometheus Metrics (scraped by Splunk OpenTelemetry Connector)](./examples/otel-prometheus/README.md)
4. [Prometheus Federated Metrics (scraped by Splunk OpenTelemetry Connector)](./examples/otel-prometheus-federation/README.md)
5. [Vaccine Logistics Tracking Demo](./examples/vaccine-demo/README.md)

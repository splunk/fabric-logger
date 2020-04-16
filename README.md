# Splunk Connect for Hyperledger Fabric

The Splunk Connect for Hyperledger Fabric sends blocks and transactions from a Hyperledger Fabric distributed ledger to Splunk for analytics. It's recommended (but not required) that this is used with Splunk App for Hyperledger Fabric. This app can also send blocks and transactions to stdout with use for any other system.

Currently the fabric-logger supports connecting to 1 peer at a time, so you will have to deploy multiple instances of the fabric-logger for each peer that you want to connect to. Each fabric-logger instance can monitor multiple channels for the peer it is connected to.

## Fabric ACLs Required for Splunk Connect for Hyperledger Fabric

User authentication in Hyperledger Fabric depends on a private key and a signed certificate. If using the `cryptogen` tool, these files will be found in the following directories (see also `helm-chart/fabric-logger/templates/secret.yaml`):

-   Signed Certificate: `crypto-config/peerOrganizations/<org-domain>/users/<username>@<org-domain>/msp/signcerts/<username>@<org-domain>-cert.pem`
-   Private Key: `crypto-config/peerOrganizations/<org-domain>/users/<username>@<org-domain>/msp/keystore/*_sk`

Additionally, Hyperledger Fabric users depend on ACLs defined in the `configtx.yaml` file in order to listen for events on peers. You can see all the ACLs documented [here](https://github.com/hyperledger/fabric/blob/309194182870aebc1e5faf153ea9e4aabda25b8e/sampleconfig/configtx.yaml#L144). The only required ACL policy for using this app is `event/Block`, by default this is mapped to the policy `/Channel/Application/Readers`. Any user defined under this policy in the organization can be used for the fabric-logger. User membership into policies are defined at the organization level, an example can be seen [here](https://github.com/hyperledger/fabric/blob/309194182870aebc1e5faf153ea9e4aabda25b8e/sampleconfig/configtx.yaml#L38).

## Activating Fabric Logger

Once the fabric logger starts up, it will attempt to connect to its configured peer. If you want to have it start listening on a channel, you can use the following HTTP endpoints:

### Ledger Blocks and Transactions

    curl -X PUT http://fabric-logger:8080/channels/${CHANNEL_NAME}

### Chaincode events

    curl -X PUT -H "Content-Type: application/json" -d '{"filter":"${EVENT_REGULAR_EXPRESSION}"}' http://fabric-logger:8080/channels/${CHANNEL_NAME}/events/${CHAINCODE_ID}

## Running in Docker

Running the Fabric Logger in Docker is recommended. A sample docker-compose entry looks as follows:

    services:
        fabric-logger.example.com:
            container_name: fabric-logger.example.com
            image: splunkdlt/fabric-logger:latest
            environment:
                - FABRIC_KEYFILE=<path to private key file>
                - FABRIC_CERTFILE=<path to signed certificate>
                - FABRIC_MSP=<msp name>
                - FABRIC_PEER=peer0.example.com
                - SPLUNK_HEC_TOKEN=12345678-ABCD-EFGH-IJKL-123456789012
                - SPLUNK_HEC_URL=https://splunk.example.com:8088
                - SPLUNK_INDEX=hyperledger_logs
                - LOGGING_LOCATION=splunk
                - NETWORK_CONFIG=network.yaml
            volumes:
                - ./crypto:/usr/src/app/crypto/
                - ./network.yaml:/usr/src/app/network.yaml
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

    peer:
        mspName: PeerMSP
        peerName: peer0
        username: admin
        peerAddress: peer0.example.com
        channels:
            - mychannel

    splunk:
        hec:
            token: 12345678-ABCD-EFGH-IJKL-123456789012
            url: https://splunk-splunk-kube.splunk.svc.cluster.local:8088
        index: hyperledger_logs

    secrets:
        peer:
            cert: hlf-peer--peer0-cert
            key: hlf-peer--peer0-key

### Autogenerating Secrets

Alternatively, if you are using `cryptogen` to generate identities, the helm chart can auto-populate secrets for you. You will need to download the helm file and untar it locally so you can copy your `crypto-config` into the director.

    wget https://github.com/splunk/fabric-logger/releases/download/v1.2.0/fabric-logger-helm-v1.2.0.tgz
    tar -xf fabric-logger-helm-v1.2.0.tgz
    cp -R crypto-config fabric-logger/crypto-config

Set the secrets section of `values.yaml` to:

    secrets:
        peer:
            create: true

You can now deploy using:

    helm install -n fabric-logger-${PEER_NAME}-${NS} --namespace ${NS} \
                 -f values.yaml ./fabric-logger

### Manually Populating Secrets

Make sure that the peer credentials are stored in the appropriately named secrets in the same namespace. It's not required to use the admin credential for connecting, just make sure to select the appropriate user for your use case.

    NS=default
    ADMIN_MSP_DIR=./crypto-config/peerOrganizations/peer0.example.com/users/Admin@peer0.example.com/msp

    CERT=$(find ${ADMIN_MSP_DIR}/signcerts/*.pem -type f)
    kubectl create secret generic -n ${NS} hlf-peer--peer0-cert --from-file=cert.pem=$CERT

    KEY=$(find ${ADMIN_MSP_DIR}/keystore/*_sk -type f)
    kubectl create secret generic -n ${NS} hlf-peer--peer0-key --from-file=key.pem=$KEY

A `network.yaml` will automatically be generated using the secrets and channel details set above. You can deploy via helm:

    helm install -n fabric-logger-${PEER_NAME}-${NS} --namespace ${NS} \
                 -f values.yaml \
                 https://github.com/splunk/fabric-logger/releases/download/v1.2.0/fabric-logger-helm-v1.2.0.tgz

### Deleting Helm Chart

    helm delete --purge fabric-logger-${PEER_NAME}-${NS}

## Running Locally

1.  Install dependencies:

        $ yarn install

2.  Configuration:

fabric-logger requires some configuration to connect to your blockchain. You will need to fill out the `.env` file or set the appropriate environment variables. See the section below for a list of environment variables.

You will also need to update the `network.yaml` with appropriate values for you system.

3.  Start the application:

        $ yarn start

## Environment Variables

| Environment Variable   | Description                                                                                                                                              | Default            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| FABRIC_KEYFILE         | The private key file used to authenticate with the Fabric peer.                                                                                          | None (Required)    |
| FABRIC_CERTFILE        | The signed certificate returned from the Fabric CA.                                                                                                      | None (Required)    |
| FABRIC_CLIENT_KEYFILE  | The client private key file used in mutual TLS to authenticate with the Fabric peer.                                                                     | None               |
| FABRIC_CLIENT_CERTFILE | The client signed certificate used in mutual TLS.                                                                                                        | None               |
| FABRIC_MSP             | The name of the MSP that the logging user is enrolled in.                                                                                                | None (Required)    |
| FABRIC_LOGGER_USERNAME | The username the that the `FABRIC_KEYFILE` is enrolled under.                                                                                            | None (Required)    |
| FABRIC_PEER            | The hostname of the peer to connect to.                                                                                                                  | None (Required)    |
| LOGGING_LOCATION       | The logging location, valid values are `splunk` or `stdout`.                                                                                             | `splunk`           |
| SPLUNK_HEC_TOKEN       | If using `splunk` as the logging location, the HEC token value.                                                                                          | None               |
| SPLUNK_HEC_URL         | If using `splunk` as the logging location, the url to the splunk instance event collector.                                                               | None               |
| SPLUNK_HOST  DEPRECATED| Splunk hostname. DEPRECATED Please use SPLUNK_HEC_URL.                                                                                                   | None               |
| SPLUNK_PORT  DEPRECATED| Splunk HEC port. DEPRECATED Please use SPLUNK_HEC_URL.                                                                                                   | `8088`             |
| SPLUNK_INDEX           | Splunk index to log to.                                                                                                                                  | `hyperledger_logs` |
| NETWORK_CONFIG         | A network configuration object, an example can be found [here](https://hyperledger.github.io/fabric-sdk-node/release-1.4/tutorial-network-config.html)   | None (Required)    |
| CHECKPOINTS_FILE       | A file used to hold checkpoints for each channel watched. If running in docker, be sure to mount a volume so that the file is not lost between restarts. | `.checkpoints`     |
| SOURCETYPE_PREFIX      | A prefix used for the sourcetype when writing to Splunk.                                                                                                 | `fabric_logger:`   |

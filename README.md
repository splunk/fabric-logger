# Splunk Connect for Hyperledger Fabric

The Splunk Connect for Hyperledger Fabric sends blocks and transactions from a Hyperledger Fabric distributed ledger to Splunk for analytics. It's recommended (but not required) that this is used with Splunk App for Hyperledger Fabric. This app can also send blocks and transactions to stdout with use for any other system.

Currently the fabric-logger supports connecting to 1 peer at a time, so you will have to deploy multiple instances of the fabric-logger for each peer that you want to connect to. Each fabric-logger instance can monitor multiple channels for the peer it is connected to.

## Fabric ACLs Required for Splunk Connect for Hyperledger Fabric

User authentication in Hyperledger Fabric depends on a private key and a signed certificate. If using the `cryptogen` tool, these files will be found in the following directories (see also `helm-chart/fabric-logger/templates/secret.yaml`):

-   Signed Certificate: `crypto-config/peerOrganizations/<org-domain>/users/<username>@<org-domain>/msp/signcerts/<username>@<org-domain>-cert.pem`
-   Private Key: `crypto-config/peerOrganizations/<org-domain>/users/<username>@<org-domain>/msp/keystore/*_sk`

Additionally, Hyperledger Fabric users depend on ACLs defined in the `configtx.yaml` file in order to listen for events on peers. You can see all the ACLs documented [here](https://github.com/hyperledger/fabric/blob/309194182870aebc1e5faf153ea9e4aabda25b8e/sampleconfig/configtx.yaml#L144). The only required ACL policy for using this app is `event/Block`, by default this is mapped to the policy `/Channel/Application/Readers`. Any user defined under this policy in the organization can be used for the fabric-logger. User membership into policies are defined at the organization level, an example can be seen [here](https://github.com/hyperledger/fabric/blob/309194182870aebc1e5faf153ea9e4aabda25b8e/sampleconfig/configtx.yaml#L38).

## Configuration

NOTE: In previous versions of Fabric Logger there was a web server exposed to configure channels and chaincode events. The web server has been removed in favor of configuration files.

Fabric Logger uses two files for configuration:

Connection profile `network.yaml` with the appropriate values.

`fabriclogger.yaml` which Fabric Logger uses for defining channels, peer, chaincode events etc to listen to.

Refer to fabriclogger.yaml.example for how to setup

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
            image: splunkdlt/fabric-logger:release-3.0.0
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
                - LOGGING_LOCATION=splunk
                - NETWORK_CONFIG=network.yaml
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

    peers:
        peer0:
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
            rejectInvalidCerts: "false"
        index: hyperledger_logs

    secrets:
        peer:
            cert: hlf-peer--peer0-cert
            key: hlf-peer--peer0-key
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

    wget https://github.com/splunk/fabric-logger/releases/download/2.0.2/fabric-logger-helm-v2.0.2.tgz
    tar -xf fabric-logger-helm-v2.0.2.tgz
    cp -R crypto-config fabric-logger/crypto-config

Set the secrets section of `values.yaml` to:

    secrets:
        peer:
            create: true

You can now deploy using:

    helm install -n fabric-logger-${PEER_NAME}-${NS} --namespace ${NS} \
                 -f values.yaml ./fabric-logger

### Kubernetes: Manually Populating Secrets

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
                 https://github.com/splunk/fabric-logger/releases/download/v3.0.0/fabric-logger-helm-v3.0.0.tgz

### Kubernetes: Deleting Helm Chart

    helm delete --purge fabric-logger-${PEER_NAME}-${NS}

## Running Locally

1.  Install dependencies:

        $ yarn install

2.  Configuration:

fabric-logger requires some configuration to connect to your blockchain. You will need to provide a configuration file fabriclogger.yaml or set the appropriate environment variables. See the section below for a list of environment variables.

You will also need to update the `network.yaml` with appropriate values for you system.

3.  Start the application:

        $ yarn start

## Environment Variables

| Environment Variable            | Flag                     | Description                                                                                | Default            |
| ------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------ | ------------------ |
| FABRIC_KEYFILE                  | user-key                 | The private key file used to authenticate with the Fabric peer.                            | None (Required)    |
| FABRIC_CERTFILE                 | user-cert                | The signed certificate returned from the Fabric CA.                                        | None (Required)    |
| FABRIC_CLIENT_KEYFILE           | client-keyfile           | The client private key file used in mutual TLS to authenticate with the Fabric peer.       | None               |
| FABRIC_CLIENT_CERTFILE          | client-certfile          | The client signed certificate used in mutual TLS.                                          | None               |
| FABRIC_MSP                      | msp                      | The name of the MSP that the logging user is enrolled in.                                  | None (Required)    |
| FABRIC_LOGGER_USERNAME          | user                     | The username the that the `FABRIC_KEYFILE` is enrolled under.                              | None (Required)    |
| NETWORK_CONFIG                  | network                  | A network configuration object, an example can be found [here](https://hyperledger.github.io/fabric-sdk-node/release-1.4/tutorial-network-config.html)                                                                                                                                                     | None (Required)    |
| LOGGING_LOCATION                |                          | The logging location, valid values are `splunk` or `stdout`.                               | `splunk`           |
| SPLUNK_HEC_TOKEN                | hec-token                | If using `splunk` as the logging location, the HEC token value.                            | None               |
| SPLUNK_HEC_URL                  | hec-url                  | If using `splunk` as the logging location, the url to the splunk instance event collector. | None               |
| SPLUNK_HEC_REJECT_INVALID_CERTS | hec-reject-invalid-certs | If fabric logger should reject invalid or self-signed certs when sending to splunk         | true               |
| SPLUNK_HOST DEPRECATED          | splunk-host              | Splunk hostname. DEPRECATED Please use SPLUNK_HEC_URL.                                     | None               |
| SPLUNK_PORT DEPRECATED          | splunk-port              | Splunk HEC port. DEPRECATED Please use SPLUNK_HEC_URL.                                     | `8088`             |
| SPLUNK_INDEX                    | hec-events-index         | Splunk index to log to.                                                                    | `hyperledger_logs` |
| CHECKPOINTS_FILE                |                          | A file used to hold checkpoints for each channel watched. If running in docker, be sure to mount a volume so that the file is not lost between restarts.                                                                                                                                                 | `.checkpoints`     |
| FABRIC_LOGGER_CONFIG            | config-file              | Location of a yaml file for fabric logger configuration, see example file fabriclogger.yaml.example | fabriclogger.yaml |
| FABRIC_DISCOVERY                | discovery                | Indicates if peers and orderers should be discovered using the discovery service.  If set to false only the network.yaml will be used | false |
| FABRIC_DISCOVERY_AS_LOCALHOST   | discovery-as-localhost   | Convert discovered host addresses to be localhost. Will be needed when running a docker composed fabric network on the local system; otherwise should be disabled. | false |
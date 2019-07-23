Splunk Connect for Hyperledger Fabric
=====================================

They Splunk Connect for Hyperledger Fabric sends blocks and transactions from a Hyperledger Fabric distributed ledger to Splunk for analytics. It's recommended (but not required) that this is used with Splunk App for Hyperledger Fabric. This app can also send blocks and transactions to stdout with use for any other system.

Currently the fabric-logger only supports connecting to 1 peer at a time, so you will have to deploy multiple instances of the fabric-logger for each peer that you want to connect to. Each fabric-logger instance can monitor multiple channels for the peer its connected to.

Activating Fabric Logger
------------------------
Once the fabric logger starts up, it will attempt to connect to its configured peer. If you want to have it start listening on a channel, you can use the following HTTP endpoint:

    curl http://fabric-logger:8080/channels/${CHANNEL_NAME}

Running in Docker
-----------------
Running the Fabric Logger in Docker is recommended. A sample docker-compose entry looks as follows:

    services:
        fabric-logger.example.com:
            container_name: fabric-logger.example.com
            image: splunkdlt/fabric-logger:latest
            environment:
                - FABRIC_KEYFILE=
                - FABRIC_CERTFILE=
                - FABRIC_MSP=
                - FABRIC_PEER=peer0.example.com
                - SPLUNK_HEC_TOKEN=12345678-ABCD-EFGH-IJKL-123456789012
                - SPLUNK_HOST=splunk.example.com
                - SPLUNK_PORT=8088
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

Running in Kubernetes
---------------------
We also include a helm chart for Kubernetes deployments. First set your `values.yaml` file. Here is an example configuration (although this will be specific to your environment):

    peer:
        mspName: PeerMSP
        peerName: peer0
        username: admin

    splunk:
        hec:
            token: 12345678-ABCD-EFGH-IJKL-123456789012
            port: 8088
            host: splunk-splunk-kube.splunk.svc.cluster.local
        index: hyperledger_logs

Make sure that the peer credentials are stored in the appropriately named secrets in the same namespace. It's not required to use the admin credential for connecting, just make sure to select the appropriate user for your use case.

    ADMIN_MSP_DIR=./crypto-config/peerOrganizations/peer0.example.com/users/Admin@peer0.example.com/msp

    # Admin Certs
    ORG_CERT=$(find ${ADMIN_MSP_DIR}/admincerts/*.pem -type f)
    kubectl create secret generic -n ${NS} hlf--peer-admincert --from-file=cert.pem=$ORG_CERT

    ORG_KEY=$(find ${ADMIN_MSP_DIR}/keystore/*_sk -type f)
    kubectl create secret generic -n ${NS} hlf--peer-adminkey --from-file=key.pem=$ORG_KEY 

Finally, this also requires a `network.yaml` file to be located at the `network.networkConfigMap` value.

    kubectl create configmap -n ${NS} hlf-network-config --from-file=network.yaml=<your network.yaml file>

Once that's done, you can deploy via helm:

    helm install -n fabric-logger-${PEER_NAME}-${NS} --namespace ${NS} \
                 -f values.yaml \
                 https://github.com/splunk/fabric-logger/releases/download/v1.1.0/fabric-logger-helm-v1.1.0.tgz

To remove, you can simply:

    helm delete --purge fabric-logger-${PEER_NAME}-${NS}

Running Locally
---------------

1. Install dependencies:

        $ npm install

2. Configuration:

fabric-logger requires some configuration to connect to your blockchain.  You will need to fill out the `.env` file or set the appropriate environment variables. See the section below for a list of environment variables.

You will also need to update the `network.yaml` with appropriate values for you system.

3. Start the application:

        $ node app.js

Environment Variables
---------------------

| Environment Variable | Description | Default |
|----------------------|-------------|---------|
| FABRIC_KEYFILE       | The private key file used to authenticate with the Fabric peer. | None (Required) |
| FABRIC_CERTFILE      | The signed certificate returned from the Fabric CA. | None (Required) |
| FABRIC_MSP           | The name of the MSP that the logging user is enrolled in. | None (Required) |
| FABRIC_LOGGER_USERNAME | The username the that the `FABRIC_KEYFILE` is enrolled under. | None (Required) |
| FABRIC_PEER          | The hostname of the peer to connect to. | None (Required) |
| LOGGING_LOCATION     | The logging location, valid values are `splunk` or `stdout`. | `splunk` |
| SPLUNK_HEC_TOKEN     | If using `splunk` as the logging location, the HEC token value. | None |
| SPLUNK_HOST          | Splunk hostname. | None |
| SPLUNK_PORT          | Splunk HEC port. | `8088` |
| SPLUNK_INDEX         | Splunk index to log to. | `hyperledger_logs` |
| NETWORK_CONFIG       | A network configuration object, an example can be found [here](https://fabric-sdk-node.github.io/release-1.4/tutorial-network-config.html) | None (Required) |
| CHECKPOINTS_FILE     | A file used to hold checkpoints for each channel watched. If running in docker, be sure to mount a volume so that the file is not lost between restarts. | `.checkpoints` |
| SOURCETYPE_PREFIX    | A prefix used for the sourcetype when writing to Splunk. | `fabric_logger:` |

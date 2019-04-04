fabric-logger
==================================================

This Node.js application logs blocks and transactions on a Hyperledger Fabric network to Splunk.

Running in Docker
-----------------

Running the Fabric Logger in Docker is recommended. A sample docker-compose entry looks as follows:

        services:
                febric-logger.example.com:
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
                        networks:
                                - hlf_network

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
| FABRIC_PEER          | The hostname of the peer to connect to. | None (Required) |
| LOGGING_LOCATION     | The logging location, valid values are `splunk` or `stdout`. | `splunk` |
| SPLUNK_HEC_TOKEN     | If using `splunk` as the logging location, the HEC token value. | None |
| SPLUNK_HOST          | Splunk hostname. | None |
| SPLUNK_PORT          | Splunk HEC port. | `8088` |
| SPLUNK_INDEX         | Splunk index to log to. | `hyperledger_logs` |
| NETWORK_CONFIG       | A network configuration object, an example can be found [here](https://fabric-sdk-node.github.io/release-1.4/tutorial-network-config.html) | None (Required) |
| CHECKPOINTS_FILE     | A file used to hold checkpoints for each channel watched. If running in docker, be sure to mount a volume so that the file is not lost between restarts. | `.checkpoints` |

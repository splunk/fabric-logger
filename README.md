fabric-logger
==================================================

This Node.js application logs blocks and transactions on a hyperledger fabric network to splunk.

Getting Started
---------------

1. Install dependencies:

        $ npm install

2. Configuration:

fabric-logger requires some configuration to connect to your blockchain.  You will need to fill out the .env file or set the appropriate environment variables.

        FABRIC_KEYFILE=
        FABRIC_CERTFILE=
        FABRIC_MSP=
        FABRIC_PEER=
        SPLUNK_HEC_TOKEN=12345678-1234-1234-1234-123456789012
        SPLUNK_HOST=192.168.0.101
        SPLUNK_PORT=8088

You will also need to update the network.yaml with appropriate values for you system.


3. Start the application:

        $ node app.js

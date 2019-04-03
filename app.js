'use strict';
require('dotenv').config();
const fs = require('fs');
const express = require('express');
const hfc = require('fabric-client');
const app = express();
const SplunkLogger = require('splunk-logging').Logger;

// Constants
const SPLUNK_HOST = process.env.SPLUNK_HOST;
const SPLUNK_PORT = process.env.SPLUNK_PORT;
const SPLUNK_HEC_TOKEN = process.env.SPLUNK_HEC_TOKEN;
const SPLUNK_INDEX = process.env.SPLUNK_INDEX || "hyperledger_logs"
const FABRIC_PEER = process.env.FABRIC_PEER;
const FABRIC_MSP = process.env.FABRIC_MSP;
const LOGGING_LOCATION = process.env.LOGGING_LOCATION || "splunk";
const NETWORK_CONFIG = process.env.NETWORK_CONFIG;

var client = hfc.loadFromConfig(NETWORK_CONFIG);

client.setAdminSigningIdentity(
	fs.readFileSync(process.env.FABRIC_KEYFILE, 'utf8'),
	fs.readFileSync(process.env.FABRIC_CERTFILE, 'utf8'),
	FABRIC_MSP
);

switch(LOGGING_LOCATION) {
	case 'splunk':
		var splunkConfig = {
			token: SPLUNK_HEC_TOKEN,
			url: 'https://' + SPLUNK_HOST + ':' + SPLUNK_PORT
		};
		var Logger = new SplunkLogger(splunkConfig);
		Logger.eventFormatter = function(message, severity) {
			var event = message;
			return event;
		}
		console.log(`Using Splunk HEC at ${splunkConfig.url}`);
		break;
	case 'stdout':
		var Logger = {};
		Logger.send = (event) => {
			console.log(JSON.stringify(event));
		}
		break;
}

Logger.error = function(err, context) {
	console.log('error', err, 'context', context);
};

function logEvent(event, sourcetype) {
	Logger.send({
		message: event,
		metadata: {
			source: FABRIC_PEER,
			sourcetype: sourcetype,
			index: SPLUNK_INDEX
		}
	});

	if (LOGGING_LOCATION == 'splunk') {
		console.log(`Posted sourcetype=${sourcetype} to Splunk index=${SPLUNK_INDEX} from peer=${FABRIC_PEER}.`);
	}
}

async function asyncEHWrapper(eh) {
	eh.connect({ 'full_block': true });
}

app.get('/channels/:channel', (req, res) => {
	let eh = client.getChannel(req.params["channel"]).newChannelEventHub(FABRIC_PEER);
	eh.registerBlockEvent(
		(block) => {
			logEvent(block, "ledger-block");

			// Message types are defined here:
			// https://github.com/hyperledger/fabric-sdk-node/blob/release-1.4/fabric-client/lib/protos/common/common.proto
			for (let index = 0; index < block.data.data.length; index++) {
				let msg = block.data.data[index];
				logEvent(msg, msg.payload.header.channel_header.typeString)
			} 
		},
		(error) => { Logger.error('Failed to receive the tx event ::' + error); },
		{ 'startBlock': 1 } // TODO: have some sort of last block file that we can tap.
	)
	asyncEHWrapper(eh);

	res.send(`Connecting to ${req.params["channel"]} on ${FABRIC_PEER}\n`);
});

app.get('/healthcheck', (req, res) => {
	res.send('ok!');
});

const HOST = "0.0.0.0";
const PORT = 8080;
app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);

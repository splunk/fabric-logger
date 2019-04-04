'use strict';
require('dotenv').config();
const fs = require('fs');
const express = require('express');
const hfc = require('fabric-client');
const ini = require('ini');
const app = express();
const SplunkLogger = require('splunk-logging').Logger;

// Constants
const SPLUNK_HOST = process.env.SPLUNK_HOST;
const SPLUNK_PORT = process.env.SPLUNK_PORT || 8088;
const SPLUNK_HEC_TOKEN = process.env.SPLUNK_HEC_TOKEN;
const SPLUNK_INDEX = process.env.SPLUNK_INDEX || "hyperledger_logs"
const FABRIC_PEER = process.env.FABRIC_PEER;
const FABRIC_MSP = process.env.FABRIC_MSP;
const LOGGING_LOCATION = process.env.LOGGING_LOCATION || "splunk";
const NETWORK_CONFIG = process.env.NETWORK_CONFIG;
const CHECKPOINTS_FILE = process.env.CHECKPOINTS_FILE || ".checkpoints";

var client = hfc.loadFromConfig(NETWORK_CONFIG);
client.createUser({
	username: 'fabric-logger',
	mspid: FABRIC_MSP,
	cryptoContent: {
		privateKey: process.env.FABRIC_KEYFILE,
		signedCert: process.env.FABRIC_CERTFILE,
	},
	skipPersistence: true
});

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

function loadCheckpoints (filename) {
	let checkpoints = '';
  if (fs.existsSync(filename)) {
    checkpoints = fs.readFileSync(filename, 'utf-8');
  }
  return ini.parse(checkpoints);
}

function writeCheckpoints(filename, checkpoints) {
	fs.writeFileSync(filename, ini.stringify(checkpoints));
}

async function asyncEHWrapper(eh) {
	eh.connect({ 'full_block': true });
}

app.get('/channels/:channel', (req, res) => {
	let channel = req.params["channel"];

	// Only one listener required per channel per peer.
	if (eventHubs[channel] != undefined && eventHubs[channel].isconnected()) {
		res.send(`Fabric logger already started on ${channel} on peer ${FABRIC_PEER}.\n`)
		return;
	}

	eventHubs[channel] = client.getChannel(channel).newChannelEventHub(FABRIC_PEER);
	if (checkpoints[channel] == undefined) {
		checkpoints[channel] = 1;
	}

	eventHubs[channel].registerBlockEvent(
		(block) => {
			logEvent(block, "ledger-block");

			// Message types are defined here:
			// https://github.com/hyperledger/fabric-sdk-node/blob/release-1.4/fabric-client/lib/protos/common/common.proto
			for (let index = 0; index < block.data.data.length; index++) {
				let msg = block.data.data[index];
				logEvent(msg, msg.payload.header.channel_header.typeString)
			} 

			// TODO: Log chaincode events here.

			// TODO: Ensure that every block only contains txns for one channel.
			let channel_id = block.data.data[0].payload.header.channel_header.channel_id
			checkpoints[channel_id] = block.header.number;
			writeCheckpoints(CHECKPOINTS_FILE, checkpoints);
		},
		(error) => { Logger.error('Failed to receive the tx event ::' + error); },
		{ 'startBlock': checkpoints[channel] }
	)
	asyncEHWrapper(eventHubs[channel]);

	res.send(`Connecting to ${req.params["channel"]} on ${FABRIC_PEER}\n`);
});

app.get('/healthcheck', (req, res) => {
	res.send('ok!');
});

var checkpoints = loadCheckpoints(CHECKPOINTS_FILE);
var eventHubs = {};
const HOST = "0.0.0.0";
const PORT = 8080;
app.listen(PORT, HOST, () => {
	console.log(`Running on http://${HOST}:${PORT}`);
});

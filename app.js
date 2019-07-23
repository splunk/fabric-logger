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
const SOURCETYPE_PREFIX = process.env.SOURCETYPE_PREFIX || "fabric_logger:";
const FABRIC_LOGGER_USERNAME = process.env.FABRIC_LOGGER_USERNAME;

var client;

function initClient() {
	if (NETWORK_CONFIG == 'mock') {
		return;
	}

	client = hfc.loadFromConfig(NETWORK_CONFIG);
	client.createUser({
		username: FABRIC_LOGGER_USERNAME,
		mspid: FABRIC_MSP,
		cryptoContent: {
			privateKey: process.env.FABRIC_KEYFILE,
			signedCert: process.env.FABRIC_CERTFILE,
		},
		skipPersistence: true
	});
}

switch(LOGGING_LOCATION) {
	case 'splunk':
		var splunkConfig = {
			token: SPLUNK_HEC_TOKEN,
			url: 'https://' + SPLUNK_HOST + ':' + SPLUNK_PORT
		};
		var Logger = new SplunkLogger(splunkConfig);
		Logger.eventFormatter = function(event, severity) {
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


function logEvent(event, sourcetype, timeField = null) {
	if (timeField == null) { timeField = Date.now() }
	Logger.send({
		message: event,
		metadata: {
			source: FABRIC_PEER,
			sourcetype: SOURCETYPE_PREFIX + sourcetype,
			index: SPLUNK_INDEX,
			time: timeField
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

function registerListener(client, hubs, channel) {
	try {
		hubs[channel] = client.getChannel(channel).newChannelEventHub(FABRIC_PEER);
	} catch (err) {
		// NOTE: seems to be an error with certain network.yaml
		// See JIRA ticket here: https://jira.hyperledger.org/browse/FABN-1222
		if (err.message == `Peer with name "${FABRIC_PEER}" not assigned to this channel`) {
			client.getChannel(channel).addPeer(client.getPeer(FABRIC_PEER));
			hubs[channel] = client.getChannel(channel).newChannelEventHub(FABRIC_PEER);
		} else {
			throw err;
		}
	}
	if (checkpoints[channel] == undefined) {
		checkpoints[channel] = 1;
	}

	hubs[channel].registerBlockEvent(
		(block) => {
			// Message types are defined here:
			// https://github.com/hyperledger/fabric-sdk-node/blob/release-1.4/fabric-client/lib/protos/common/common.proto
			for (let index = 0; index < block.data.data.length; index++) {
        // TODO: Log chaincode events here.
				// payload.data.actions{}.payload.action.proposal_response_payload.extension.events.payload.data{}

				let msg = block.data.data[index];
				try {
					if ('payload' in msg) {
						msg.payload.header.channel_header.extension_utf8 = msg.payload.header.channel_header.extension.toString('utf8');
						msg.payload.header.channel_header.extension_hex = msg.payload.header.channel_header.extension.toString('hex');

						if ('data' in msg.payload && 'actions' in msg.payload.data) {
							for (let action = 0; action < msg.payload.data.actions.length; action++) {
								let args_utf8 = [];
								let args_hex = [];
								for (let arg = 0; arg < msg.payload.data.actions[action].payload.chaincode_proposal_payload.input.chaincode_spec.input.args.length; arg++) {
									args_utf8.push(msg.payload.data.actions[action].payload.chaincode_proposal_payload.input.chaincode_spec.input.args[arg].toString('utf8'));
									args_hex.push(msg.payload.data.actions[action].payload.chaincode_proposal_payload.input.chaincode_spec.input.args[arg].toString('hex'));
								}
								msg.payload.data.actions[action].payload.chaincode_proposal_payload.input.chaincode_spec.input.args_utf8 = args_utf8;
								msg.payload.data.actions[action].payload.chaincode_proposal_payload.input.chaincode_spec.input.args_hex = args_hex;
							}
						}
					}
				} catch (err) {
					console.log(`Error decoding data to utf8: ${err}`);
				}

				logEvent(msg, msg.payload.header.channel_header.typeString.toLowerCase())
			} 

			// TODO: set the timestamp as the min / max / current on the transactions?
			logEvent(block, "block");

			let channel_id = block.data.data[0].payload.header.channel_header.channel_id
			checkpoints[channel_id] = block.header.number;
			writeCheckpoints(CHECKPOINTS_FILE, checkpoints);
		},
		(error) => { Logger.error('Failed to receive the tx event ::' + error); },
		{ 'startBlock': checkpoints[channel] }
	)
	asyncEHWrapper(hubs[channel]);
}

app.get('/channels/:channel', (req, res) => {
	let channel = req.params["channel"];

	// Only one listener required per channel per peer.
	if (eventHubs[channel] != undefined && eventHubs[channel].isconnected()) {
		res.send(`Fabric logger already started on ${channel} on peer ${FABRIC_PEER}.\n`)
		return;
	}

	registerListener(client, eventHubs, channel);
	res.send(`Connecting to ${req.params["channel"]} on ${FABRIC_PEER}\n`);
});

app.delete('/channels/:channel', (req, res) => {
	let channel = req.params["channel"];
	eventHubs[channel].disconnect();
});

app.get('/healthcheck', (req, res) => {
	res.send('ok!');
});

var checkpoints = loadCheckpoints(CHECKPOINTS_FILE);
var eventHubs = {};
const HOST = "0.0.0.0";
const PORT = 8080;
var server = app.listen(PORT, HOST, () => {
	initClient();
	console.log(`Running on http://${HOST}:${PORT}`);
});

module.exports = {
	server: server,
	registerListener: registerListener
}
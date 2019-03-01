'use strict';
require('dotenv').config();
const fs = require('fs');
const express = require('express');
const hfc = require('fabric-client');
const app = express();

// Constants
const SPLUNK_HEC_URL = process.env.SPLUNK_HEC_URL;
const SPLUNK_HEC_TOKEN = process.env.SPLUNK_HEC_TOKEN;
const FABRIC_PEER = process.env.FABRIC_PEER;
const FABRIC_MSP = process.env.FABRIC_MSP;

var client = hfc.loadFromConfig('network.yaml');

client.setAdminSigningIdentity(
	fs.readFileSync(process.env.FABRIC_KEYFILE, 'utf8'),
	fs.readFileSync(process.env.FABRIC_CERTFILE, 'utf8'),
	FABRIC_MSP
);

var splunkConfig = {
	token: SPLUNK_HEC_TOKEN,
	url: SPLUNK_HEC_URL,
};
var Logger = new SplunkLogger(splunkConfig);
Logger.error = function(err, context) {
	console.log('error', err, 'context', context);
};
Logger.eventFormatter = function(message, severity) {
	var event = message;
	return event;
}

function postToSplunk(event, sourcetype) {
	Logger.send(
		{
			"index": "hyperledger_logs",
			"sourcetype": sourcetype,
			"event": event
		});
	console.log("Posted " + sourcetype + " to splunk.")
}

async function asyncEHWrapper(eh) {
	eh.connect({ 'full_block': true });
}

app.get('/channels/:channel', (req, res) => {
	let eh = client.getChannel(req.params["channel"]).newChannelEventHub(FABRIC_PEER);
	eh.registerBlockEvent(
		(block) => {
			postToSplunk(block, "ledger-block");

			// Message types are defined here:
			// https://github.com/hyperledger/fabric-sdk-node/blob/release-1.4/fabric-client/lib/protos/common/common.proto
			for (let index = 0; index < block.data.data.length; index++) {
				let msg = block.data.data[index];
				postToSplunk(msg, msg.payload.header.channel_header.typeString)
			} 
		},
		(error) => { console.log('Failed to receive the tx event ::' + error); },
		{ 'startBlock': 1 }
	)
	asyncEHWrapper(eh);

	res.send("Connecting to " + req.params["channel"] + " on "  + FABRIC_PEER)
});

app.get('/healthcheck', (req, res) => {
	res.send('ok!')
});

const HOST = "0.0.0.0";
const PORT = 8080;
app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);
#
# Copyright IBM Corp All Rights Reserved
#
# SPDX-License-Identifier: Apache-2.0
#
set -e

export FABRIC_CFG_PATH=${PWD}/config
export CORE_PEER_TLS_ENABLED=true
export ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem
export CHAINCODE_VERSION=1.12

function createChannel() {
	CHANNEL_NAME=$1

	# Generate channel configuration transaction
	echo "========== Creating channel transaction for: "$CHANNEL_NAME" =========="
	configtxgen -profile TwoOrgsChannel -outputCreateChannelTx ../channel-artifacts/$CHANNEL_NAME-channel.tx -channelID $CHANNEL_NAME
	res=$?
	if [ $res -ne 0 ]; then
	    echo "Failed to generate channel configuration transaction..."
	    exit 1
	fi


	# Channel creation
	echo "========== Creating channel: "$CHANNEL_NAME" =========="
	peer channel create -o orderer.example.com:7050 -c $CHANNEL_NAME -f ../channel-artifacts/$CHANNEL_NAME-channel.tx --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA
}

function joinChannel() {
	PEER_NAME=$1
	CHANNEL_NAME=$2
	MSP_ID=$3
	IS_ANCHOR=$4

	ORG_NAME=$( echo $PEER_NAME | cut -d. -f1 --complement)

	echo "========== Joining "$PEER_NAME" to channel "$CHANNEL_NAME" =========="
	export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/$ORG_NAME/users/Admin@$ORG_NAME/msp
	export CORE_PEER_ADDRESS=$PEER_NAME:7051
	export CORE_PEER_LOCALMSPID="$MSP_ID"
	export CORE_PEER_TLS_CLIENTAUTHREQUIRED=true
	export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/$ORG_NAME/msp/tlscacerts/tlsca.$ORG_NAME-cert.pem
	export CORE_PEER_TLS_CLIENTKEY_FILE=$(find /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/$ORG_NAME/tlsca/ -type f -not -path *.pem)
	export CORE_PEER_TLS_CLIENTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/$ORG_NAME/tlsca/tlsca.$ORG_NAME-cert.pem
	peer channel join -b ${CHANNEL_NAME}.block --tls --clientauth

	if [ ${IS_ANCHOR} -ne 0 ]; then
		echo "========== Generating anchor peer definition for: "$CHANNEL_NAME" =========="
	    configtxgen -profile TwoOrgsChannel -outputAnchorPeersUpdate ../channel-artifacts/$CHANNEL_NAME-${CORE_PEER_LOCALMSPID}anchors.tx -channelID $CHANNEL_NAME -asOrg $MSP_ID

		res=$?
		if [ $res -ne 0 ]; then
		    echo "Failed to generate channel configuration transaction..."
		    exit 1
		fi
		# if anchor then update this.
		peer channel update -o orderer.example.com:7050 -c ${CHANNEL_NAME} -f ../channel-artifacts/${CHANNEL_NAME}-${CORE_PEER_LOCALMSPID}anchors.tx --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA
	fi
}

function installChaincode() {
	PEER_NAME=$1
	CHAINCODE_NAME=$2
	MSP_ID=$3
	VERSION=$4
	ORG_NAME=$( echo $PEER_NAME | cut -d. -f1 --complement)

	echo "========== Installing chaincode [${CHAINCODE_NAME}] on ${PEER_NAME} =========="
	export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG_NAME}/users/Admin@${ORG_NAME}/msp
	export CORE_PEER_ADDRESS=${PEER_NAME}:7051
	export CORE_PEER_LOCALMSPID="${MSP_ID}"
	export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG_NAME}/peers/${PEER_NAME}/tls/ca.crt
	export CORE_PEER_TLS_CLIENTAUTHREQUIRED=true
	export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/$ORG_NAME/msp/tlscacerts/tlsca.$ORG_NAME-cert.pem
	export CORE_PEER_TLS_CLIENTKEY_FILE=$(find /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/$ORG_NAME/tlsca/ -type f -not -path *.pem)
	export CORE_PEER_TLS_CLIENTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/$ORG_NAME/tlsca/tlsca.$ORG_NAME-cert.pem
	peer chaincode install -n $CHAINCODE_NAME -v $VERSION ~/${CHAINCODE_NAME}.tar.gz
}

function instantiateChaincode() {
	PEER_NAME=$1
	CHANNEL_NAME=$2
	CHAINCODE_NAME=$3
	MSP_ID=$4
	VERSION=$5

	ORG_NAME=$( echo $PEER_NAME | cut -d. -f1 --complement)

	echo "========== Instantiating chaincode [${CHAINCODE_NAME}] on ${PEER_NAME} in ${CHANNEL_NAME} =========="
	export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG_NAME}/users/Admin@${ORG_NAME}/msp
	export CORE_PEER_ADDRESS=${PEER_NAME}:7051
	export CORE_PEER_LOCALMSPID="${MSP_ID}"
	export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG_NAME}/peers/${PEER_NAME}/tls/ca.crt
	peer chaincode instantiate -o orderer.example.com:7050 --tls $CORE_PEER_TLS_ENABLED \
		--cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem \
		-C $CHANNEL_NAME -n $CHAINCODE_NAME -c '{"Args": []}' \
		-v $VERSION -P "OR ('ButtercupMSP.member','PopstarMSP.member')"
}

function packageChaincode(){
	CHAINCODE_NAME=$1
	CHAINCODE_LANG=$2
	VERSION=$3
	peer chaincode package ~/${CHAINCODE_NAME}.tar.gz --path github.com/hyperledger/fabric/splunk/chaincode/go/ --lang ${CHAINCODE_LANG} -n ${CHAINCODE_NAME} -v ${VERSION}
}


# Create any number of channels here with new names.
createChannel "vaccines"
createChannel "ingredients"

joinChannel "peer0.buttercup.example.com" "vaccines" "ButtercupMSP" 1
joinChannel "peer1.buttercup.example.com" "vaccines" "ButtercupMSP" 0
joinChannel "peer0.popstar.example.com" "vaccines" "PopstarMSP" 1
joinChannel "peer1.popstar.example.com" "vaccines" "PopstarMSP" 0

joinChannel "peer0.buttercup.example.com" "ingredients" "ButtercupMSP" 1
joinChannel "peer1.buttercup.example.com" "ingredients" "ButtercupMSP" 0
joinChannel "peer0.popstar.example.com" "ingredients" "PopstarMSP" 1
joinChannel "peer1.popstar.example.com" "ingredients" "PopstarMSP" 0

packageChaincode "splunk_cc" "golang" "${CHAINCODE_VERSION}"

# Install chaincode onto peers. Do not worry about channels here.
installChaincode "peer0.buttercup.example.com" "splunk_cc" "ButtercupMSP" "${CHAINCODE_VERSION}"
installChaincode "peer1.buttercup.example.com" "splunk_cc" "ButtercupMSP" "${CHAINCODE_VERSION}"
installChaincode "peer0.popstar.example.com" "splunk_cc" "PopstarMSP" "${CHAINCODE_VERSION}"
installChaincode "peer1.popstar.example.com" "splunk_cc" "PopstarMSP" "${CHAINCODE_VERSION}"

# Instantiate chaincode on each channel.
instantiateChaincode "peer0.buttercup.example.com" "vaccines" "splunk_cc" "ButtercupMSP" "${CHAINCODE_VERSION}"
instantiateChaincode "peer0.buttercup.example.com" "ingredients" "splunk_cc" "ButtercupMSP" "${CHAINCODE_VERSION}"


# These set up channel logging to Splunk
curl -X PUT fabric-logger.example.com:8080/channels/vaccines
curl -X PUT fabric-logger.example.com:8080/channels/ingredients

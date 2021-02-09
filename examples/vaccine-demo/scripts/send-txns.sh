#!/bin/bash
set -e

apt-get update && apt-get install -y jq uuid-runtime

ROUTE_1="Denver, CO|Columbus, OH|Atlanta, GA"
ROUTE_2="Baltimore, MD|Atlanta, GA"
ROUTE_3="Columbus, OH|Atlanta, GA"
ROUTE_4="Denver, CO|Columbus, OH|Atlanta, GA"
ROUTE_5="Atlanta, GA"

DIST_ROUTE_1="Nashville, TN|Chicago, IL|Minneapolis, MN"
DIST_ROUTE_2="Nashville, TN|Denver, CO|San Francisco, CA"
DIST_ROUTE_3="Raleigh, NC|Washington, DC|New York, NY|Boston, MA"

# INGREDIENTS
declare -a ING_1=('MF59' 'Adjuvant' 'Tucson, AZ');
declare -a ING_2=('Aluminum Hydroxide' 'Adjuvant' 'Syracuse, NY');
declare -a ING_3=('Thiomersal' 'Preservative' 'Lincoln, NE');
declare -a ING_4=('Gelatine' 'Stabiliser' 'Casper, WY');
declare -a ING_5=('Polysorbate 80' 'Emulsifier' 'Charleston, SC');
# ITEMS
declare -a ITEM_1=('Fluvax' 'Flu Vaccine' 'Atlanta, GA');
declare -a ITEM_1_INGREDIENTS=('ING_1' 'ING_2' 'ING_3' 'ING_4' 'ING_5');

declare -a MIN_TEMPS=('32' '33' '34' '35' '36' '37' '38' '39')
declare -a MAX_TEMPS=('48' '49' '50' '51' '52')

CC_NAME="splunk_cc"

if [ -z $1 ]; then
	echo "No transactions per second arg passed, setting to 1 by default"
	TRANSACTIONS_PER_SECOND=1
else
	TRANSACTIONS_PER_SECOND=$1
fi

echo "================= Vaccine Tracking ================="
cat << "EOF"
              _________
             {_________}
              )=======(
             /         \
            | _________ |
            ||   _     ||
            ||  |_)    ||
            ||  | \/   ||
            ||    /\   ||
            |'---------'|
            `-.........-'

EOF

send_txn() {
  local txn="$1"
  local channel="$2"
  peer chaincode invoke -o orderer.example.com:7050  \
              --tls $CORE_PEER_TLS_ENABLED \
              --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem  \
              -C $channel -n $CC_NAME \
              -c "$txn"
}

ing_generate() {
  local item_uid=$1
  local ing_name=$2
  local ing_loc_mfg=$3
  local ing_type=$4
  IFS="|" read -a route <<< $5
  local ing_uid=$(uuidgen)
  local min_temp1=${MIN_TEMPS[$((RANDOM % 8))]}
  local max_temp1=${MAX_TEMPS[$((RANDOM % 5))]}
  sleep 5
  local dt1=$(date '+%Y/%m/%d %H:%M:%S');
  local txn1='{"Args":["ingredient","'$item_uid'","'$ing_uid'","'$ing_name'","'$ing_type'","'$ing_loc_mfg'","'$dt1'","1234","manufacture","'$min_temp1'","'$max_temp1'"]}'
  send_txn "$txn1" "ingredients"
  ing_route_len=${#route[@]}
  for (( k = 0; k < $ing_route_len; ++k ))
  do
    local min_temp2=${MIN_TEMPS[$((RANDOM % 8))]}
    local max_temp2=${MAX_TEMPS[$((RANDOM % 5))]}
    sleep 5
    local dt2=$(date '+%Y/%m/%d %H:%M:%S');
    local txn2='{"Args":["ingredient","'$item_uid'","'$ing_uid'","'$ing_name'","'$ing_type'","'${route[$k]}'","'$dt2'","1234","move","'$min_temp2'","'$max_temp2'"]}'
    send_txn "$txn2" "ingredients"
  done
  sleep 5
  echo "$ing_uid"
}

item_move() {
  IFS="|" read -a route <<< $1
  item_route_len=${#route[@]}
  for (( k = 0; k < $item_route_len; ++k ))
  do
    local item_uid=$2
    local item_name=$3
    local item_type=$4
    local event_date=$(date '+%Y/%m/%d %H:%M:%S');
    local item_ingredients=$5
    local item_min_temp=${MIN_TEMPS[$((RANDOM % 8))]}
    local item_max_temp=${MAX_TEMPS[$((RANDOM % 5))]}
    local item_txn='{"Args":["item","'$item_uid'","'$item_name'","'$item_type'","'${route[$k]}'","'$event_date'","1234","'$item_ingredients'","move","'$item_min_temp'","'$item_max_temp'"]}'
    sleep 5
    send_txn "$item_txn" "vaccines"
  done
  sleep 5
}

echo "Press [CTRL+C] to stop.."
while :
do
	for (( i = 0; i < $TRANSACTIONS_PER_SECOND; ++i ))
	do
		if [ $((RANDOM % 2)) == 1 ]; then
			ORG_NAME="buttercup"
			CORE_PEER_ADDRESS=peer0.buttercup.example.com:7051
			CORE_PEER_LOCALMSPID=ButtercupMSP
			CORE_PEER_TLS_CERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/buttercup.example.com/peers/peer0.buttercup.example.com/tls/server.crt
			CORE_PEER_TLS_KEY_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/buttercup.example.com/peers/peer0.buttercup.example.com/tls/server.key
			CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/buttercup.example.com/peers/peer0.buttercup.example.com/tls/ca.crt
			CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/buttercup.example.com/users/Admin@buttercup.example.com/msp
			export CORE_PEER_TLS_CLIENTAUTHREQUIRED=true
			export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/$ORG_NAME.example.com/msp/tlscacerts/tlsca.$ORG_NAME.example.com-cert.pem
			export CORE_PEER_TLS_CLIENTKEY_FILE=$(find /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/$ORG_NAME.example.com/tlsca/ -type f -not -path *.pem)
			export CORE_PEER_TLS_CLIENTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/$ORG_NAME.example.com/tlsca/tlsca.$ORG_NAME.example.com-cert.pem
		else
			ORG_NAME="popstar"
			CORE_PEER_ADDRESS=peer0.popstar.example.com:7051
			CORE_PEER_LOCALMSPID=PopstarMSP
			CORE_PEER_TLS_CERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/popstar.example.com/peers/peer0.popstar.example.com/tls/server.crt
			CORE_PEER_TLS_KEY_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/popstar.example.com/peers/peer0.popstar.example.com/tls/server.key
			CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/popstar.example.com/peers/peer0.popstar.example.com/tls/ca.crt
			CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/popstar.example.com/users/Admin@popstar.example.com/msp
			export CORE_PEER_TLS_CLIENTAUTHREQUIRED=true
			export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/$ORG_NAME.example.com/msp/tlscacerts/tlsca.$ORG_NAME.example.com-cert.pem
			export CORE_PEER_TLS_CLIENTKEY_FILE=$(find /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/$ORG_NAME.example.com/tlsca/ -type f -not -path *.pem)
			export CORE_PEER_TLS_CLIENTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/$ORG_NAME.example.com/tlsca/tlsca.$ORG_NAME.example.com-cert.pem
		fi

    txn_count=0
    item_uuid=$(uuidgen)
    ing_length=${#ITEM_1_INGREDIENTS[@]}
    for (( j = 0; j < $ing_length; ++j ))
    do
      if [ "${ITEM_1_INGREDIENTS[$j]}" == "ING_1" ]; then
        ing1_uid=$(ing_generate "$item_uuid" "${ING_1[0]}" "${ING_1[2]}" "${ING_1[1]}" "${ROUTE_1}")
      elif [ "${ITEM_1_INGREDIENTS[$j]}" == "ING_2" ]; then
        ing2_uid=$(ing_generate "$item_uuid" "${ING_2[0]}" "${ING_2[2]}" "${ING_2[1]}" "${ROUTE_2}")
      elif [ "${ITEM_1_INGREDIENTS[$j]}" == "ING_3" ]; then
        ing3_uid=$(ing_generate "$item_uuid" "${ING_3[0]}" "${ING_3[2]}" "${ING_3[1]}" "${ROUTE_3}")
      elif [ "${ITEM_1_INGREDIENTS[$j]}" == "ING_4" ]; then
        ing4_uid=$(ing_generate "$item_uuid" "${ING_4[0]}" "${ING_4[2]}" "${ING_4[1]}" "${ROUTE_4}")
      elif [ "${ITEM_1_INGREDIENTS[$j]}" == "ING_5" ]; then
        ing5_uid=$(ing_generate "$item_uuid" "${ING_5[0]}" "${ING_5[2]}" "${ING_5[1]}" "${ROUTE_5}")
      fi
    done

    item1_ings='[\"'$ing1_uid'\",\"'$ing2_uid'\",\"'$ing3_uid'\",\"'$ing4_uid'\",\"'$ing5_uid'\"]'
    min_temp=${MIN_TEMPS[$((RANDOM % 8))]}
    max_temp=${MAX_TEMPS[$((RANDOM % 5))]}
    mfg_date=$(date '+%Y/%m/%d %H:%M:%S');
    txn='{"Args":["item","'$item_uuid'","'${ITEM_1[0]}'","'${ITEM_1[1]}'","'${ITEM_1[2]}'","'$mfg_date'","1234","'$item1_ings'","manufacture","'$min_temp'","'$max_temp'"]}'
    sleep 5
    send_txn "$txn" "vaccines"
    DIST_ROUTE=$((RANDOM % 3))
    if [ $DIST_ROUTE == 0 ]; then
      item_move "${DIST_ROUTE_1}" "$item_uuid" "${ITEM_1[0]}" "${ITEM_1[1]}" "$item1_ings"
    elif [ $DIST_ROUTE == 1 ]; then
      item_move "${DIST_ROUTE_2}" "$item_uuid" "${ITEM_1[0]}" "${ITEM_1[1]}" "$item1_ings"
    elif [ $DIST_ROUTE == 2 ]; then
      item_move "${DIST_ROUTE_3}" "$item_uuid" "${ITEM_1[0]}" "${ITEM_1[1]}" "$item1_ings"
    fi
	done

	sleep 5
done

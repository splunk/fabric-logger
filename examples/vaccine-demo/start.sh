set -ex

export FABRIC_CFG_PATH=${PWD}/scripts/config
export IMAGE_TAG="1.4.6"
export CONSENSUS_TYPE="etcdraft"
export COMPOSE_PROJECT_NAME="vaccine-tracking"


SERVICES=`docker-compose -f docker-compose-cli.yaml \
			   -f docker-compose-etcdraft2.yaml \
			   -f docker-compose-couch.yaml \
			   -f docker-compose-splunk.yaml \
			   -f docker-compose-splunk-couch.yaml \
			   -f docker-compose-splunk-etcdraft2.yaml ps -q`

# Check if services are running and warn about deleting the cryto folder.
if [ "$SERVICES" != "" ]; then
	echo "There are services running, skipping cryptogen"
else
	echo "No services running, regenerating crypto folder."

	if [ -d "crypto" ]; then
		rm -Rf crypto
	fi
	fabric-samples/bin/cryptogen generate --config=./scripts/config/crypto-config.yaml --output "crypto"
	fabric-samples/bin/configtxgen -profile SampleMultiNodeEtcdRaft -channelID byfn-sys-channel -outputBlock ./channel-artifacts/genesis.block
fi

export BUTTERCUP_ADMIN_PK=$(find crypto/peerOrganizations/buttercup.example.com/users/Admin@buttercup.example.com/msp/keystore/ -type f)
export PEER_CLIENT_PK=$(find crypto/peerOrganizations/buttercup.example.com/peers/peer0.buttercup.example.com/tls/server.key -type f)

docker-compose -f docker-compose-cli.yaml \
			   -f docker-compose-etcdraft2.yaml \
			   -f docker-compose-couch.yaml \
			   -f docker-compose-splunk.yaml \
			   -f docker-compose-splunk-couch.yaml \
			   -f docker-compose-splunk-etcdraft2.yaml up -d --build --remove-orphans

until docker logs splunk.example.com | grep -m 1 'Ansible playbook complete'
do
  echo 'Waiting for splunk to start'
  sleep 5
done

docker exec splunk.example.com /bin/bash -c 'sudo mv /opt/splunk/etc/apps/splunk-hyperledger-fabric/default/inputs.conf.example /opt/splunk/etc/apps/splunk-hyperledger-fabric/default/inputs.conf'
docker exec splunk.example.com /bin/bash -c 'sudo mv /opt/splunk/etc/apps/splunk-hyperledger-fabric/default/indexes.conf.example /opt/splunk/etc/apps/splunk-hyperledger-fabric/default/indexes.conf'
docker exec splunk.example.com /bin/bash -c 'sudo /opt/splunk/bin/splunk restart'

docker exec cli /bin/bash -c "cd ./scripts && ./channel-setup.sh"

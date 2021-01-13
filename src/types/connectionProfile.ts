/**
 * These interfaces were generated from the connection profile schema defined in
 * https://hyperledger.github.io/fabric-sdk-node/release-1.4/tutorial-network-config.html.
 */

export interface FabricConnectionProfile {
    version: string;
    client: Client;
    channels: { [key: string]: Channel };
    organizations: { [key: string]: Org };
    orderers: { [key: string]: Orderer };
    peers: { [key: string]: Peer };
    certificateAuthorities: { [key: string]: CAOrg };
}

export interface CAOrg {
    url: string;
    httpOptions: HTTPOptions;
    tlsCACerts: TLSCACerts;
    registrar: Registrar[];
    caName: string;
}

export interface HTTPOptions {
    verify: boolean;
}

export interface Registrar {
    enrollId: string;
    enrollSecret: string;
}

export interface TLSCACerts {
    path: string;
    pem: string;
}

export interface Channel {
    orderers: string[];
    peers: { [key: string]: ChannelPeer };
}

export interface ChannelPeer {
    endorsingPeer: boolean;
    chaincodeQuery: boolean;
    ledgerQuery: boolean;
    eventSource: boolean;
    discover: boolean;
}

export interface Client {
    organization: string;
    credentialStore: CredentialStore;
    connection: Connection;
}

export interface Connection {
    timeout: Timeout;
}

export interface Timeout {
    peer: Peer;
    orderer: number;
}

export interface Peer {
    endorser: number;
    eventHub: number;
    eventReg: number;
}

export interface CredentialStore {
    path: string;
    cryptoStore: CryptoStore;
}

export interface CryptoStore {
    path: string;
}

export interface Orderer {
    url: string;
    grpcOptions: grpcOptions;
    tlsCACerts: TLSCACerts;
}

export interface Org {
    mspid: string;
    peers: string[];
    certificateAuthorities: string[];
    adminPrivateKey: TLSCACerts;
    signedCert: TLSCACerts;
}

export interface Peer {
    url: string;
    grpcOptions: grpcOptions;
    tlsCACerts: TLSCACerts;
}

export interface grpcOptions {
    'ssl-target-name-override': string;
    'request-timeout': number;
}

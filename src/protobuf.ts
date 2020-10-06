import { IConversionOptions } from 'protobufjs';
import { createModuleDebug } from '@splunkdlt/debug-logging';
import { common, protos } from '../generated/protos';

const { debug, warn } = createModuleDebug('protobuf');

const DEFAULT_CONVERSION_OPTIONS: IConversionOptions = {
    enums: String,
    defaults: true,
    arrays: true,
    longs: String,
    oneofs: true,
};

interface Principal {
    principalClassification: string;
    principal?: any | null;
    principal_hex?: string | null;
    principals?: Principal[];
}

function convertIdentity(i: common.IMSPPrincipal): Principal {
    switch (i.principalClassification) {
        case common.MSPPrincipal.Classification.ROLE:
            return {
                principalClassification: 'ROLE',
                principal:
                    i.principal instanceof Buffer
                        ? common.MSPRole.toObject(common.MSPRole.decode(i.principal), DEFAULT_CONVERSION_OPTIONS)
                        : null,
            };
        case common.MSPPrincipal.Classification.ORGANIZATION_UNIT:
            return {
                principalClassification: 'ORGANIZATION_UNIT',
                principal:
                    i.principal instanceof Buffer
                        ? common.OrganizationUnit.toObject(
                              common.OrganizationUnit.decode(i.principal),
                              DEFAULT_CONVERSION_OPTIONS
                          )
                        : null,
            };
        case common.MSPPrincipal.Classification.IDENTITY:
            return {
                principalClassification: 'IDENTITY',
                principal: `¯\\_(ツ)_/¯`, // TODO - how to decode an identity principal?
                principal_hex: i.principal instanceof Buffer ? i.principal.toString('hex') : null,
            };
        case common.MSPPrincipal.Classification.ANONYMITY:
            return {
                principalClassification: 'ANONYMITY',
                principal:
                    i.principal instanceof Buffer
                        ? common.MSPIdentityAnonymity.toObject(
                              common.MSPIdentityAnonymity.decode(i.principal),
                              DEFAULT_CONVERSION_OPTIONS
                          )
                        : null,
            };
        case common.MSPPrincipal.Classification.COMBINED:
            if (i.principal instanceof Buffer) {
                const combined = common.CombinedPrincipal.decode(i.principal);
                return {
                    principalClassification: 'COMBINED',
                    principals: combined.principals.map(convertIdentity),
                };
            }
        default:
            warn('Unable to convert identity principal with classification %o', i.principalClassification);
            return {
                principalClassification: `<UNKNOWN ${i.principalClassification}>`,
                principal_hex: i.principal instanceof Buffer ? i.principal.toString('hex') : null,
            };
    }
}

export function isSignaturePolicyEnvolope(buffer: Buffer): boolean {
    try {
        const message = common.SignaturePolicyEnvelope.decode(buffer);
        const error = common.SignaturePolicyEnvelope.verify(message);
        debug('Failed to verify SignaturePolicyEnvelope: %s', error);
        return error == null;
    } catch (e) {
        return false;
    }
}

export function decodeSignaturePolicyEnvolope(buffer: Buffer): any {
    const spe = common.SignaturePolicyEnvelope.decode(buffer);
    return {
        ...common.SignaturePolicyEnvelope.toObject(spe, DEFAULT_CONVERSION_OPTIONS),
        identities: spe.identities.map(convertIdentity),
    };
}

export function decodeChaincodeDeploymentSpec(buffer: Buffer): any {
    const decoded = protos.ChaincodeDeploymentSpec.decode(buffer);
    return protos.ChaincodeDeploymentSpec.toObject(decoded, DEFAULT_CONVERSION_OPTIONS);
}

export function decodeChainCodeAction(buffer: Buffer): any {
    const decoded = protos.ChaincodeAction.decode(buffer);
    return protos.ChaincodeAction.toObject(decoded, DEFAULT_CONVERSION_OPTIONS);
}

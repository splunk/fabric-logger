import { hostname } from 'os';
import { FabricloggerConfig } from './config';
import { createModuleDebug } from '@splunkdlt/debug-logging';
import { removeEmptyValues } from './utils/obj';
import { substituteVariables, substituteVariablesInValues } from './utils/vars';

const { debug } = createModuleDebug('meta');

export interface MetadataVariables {
    /** Hostname of the machine fabriclogger is running on */
    HOSTNAME: string;
    /** The fabriclogger PID */
    PID: string;
    /** Fabriclogger version */
    VERSION: string;
    /** The node.js version fabriclogger is running on */
    NODE_VERSION: string;
}

export function substituteVariablesInHecConfig(
    config: FabricloggerConfig,
    {
        fabricloggerVersion,
        nodeVersion = process.version,
        pid = process.pid,
        host = hostname(),
    }: {
        fabricloggerVersion: string;
        nodeVersion?: string;
        pid?: number;
        host?: string;
    }
) {
    const metaVariables: MetadataVariables = {
        HOSTNAME: host,
        PID: String(pid),
        VERSION: fabricloggerVersion,
        NODE_VERSION: nodeVersion,
    };

    const resolvedVariables = removeEmptyValues(metaVariables);

    Object.entries(config.hec).forEach(([name, cfg]) => {
        debug('Replacing metadata variables in HEC config %s', name);
        if (cfg?.defaultFields != null) {
            cfg.defaultFields = substituteVariablesInValues(cfg.defaultFields, resolvedVariables);
        }
        if (cfg?.defaultMetadata != null) {
            cfg.defaultMetadata = substituteVariablesInValues(cfg.defaultMetadata, resolvedVariables);
        }
        if (cfg?.userAgent) {
            cfg.userAgent = substituteVariables(cfg.userAgent, resolvedVariables);
        }
        debug('Replaced metadata variables in HEC config: %O', {
            defaultFields: cfg?.defaultFields,
            defaultMetadata: cfg?.defaultMetadata,
            userAgent: cfg?.userAgent,
        });
    });
}

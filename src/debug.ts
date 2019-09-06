import { debug as create } from 'debug';

export const createDebug = (name: string) => create(`fabric-logger:${name}`);

export const createModuleDebug = (name: string) => {
    const debug = createDebug(name);
    const error = debug.extend('error');
    error.enabled = true;
    const warn = debug.extend('warn');
    warn.enabled = true;
    const info = debug.extend('info');
    info.enabled = true;
    return { debug, info, warn, error };
};

const isPlainObject = (obj: any): obj is Object =>
    typeof obj === 'object' && Object.prototype.toString.call(obj) === '[object Object]';

export function convertBuffers(obj: any, path: string[] = []): any {
    if (obj == null) {
        return obj;
    }
    if (obj instanceof Buffer) {
        // debug('Converting buffer value to hex at path %o', path.join('.'));
        if (isLikelyText(obj)) {
            return { string: obj.toString('utf-8') };
        } else {
            return { hex: obj.toString('hex') };
        }
    }
    if (Array.isArray(obj)) {
        return obj.map((v, i) => convertBuffers(v, [...path, String(i)]));
    } else if (isPlainObject(obj)) {
        const result: { [k: string]: any } = {};
        Object.keys(obj).forEach((k) => {
            const v = obj[k];
            if (v instanceof Buffer) {
                // debug('Converting buffer property to hex at path %o.%o', path.join('.'), k);
                if (isLikelyText(v)) {
                    result[`${k}_string`] = v.toString('utf-8');
                } else {
                    result[`${k}_hex`] = v.toString('hex');
                }
            } else {
                result[k] = convertBuffers(v, [...path, k]);
            }
        });
        return result;
    }
    return obj;
}

export function isLikelyText(buffer: Buffer): boolean {
    for (let i = 0, len = Math.min(buffer.length, 25); i < len; i++) {
        if (buffer[i] < 31) {
            return false;
        }
    }
    return true;
}

export function toText(buffer: Buffer): string {
    return buffer.toString('utf-8');
}

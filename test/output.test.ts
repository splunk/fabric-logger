import { normalizeTime } from '../src/output';

describe('normalizeTime', () => {
    const fakeNow = () => 1567161300000;
    const fakeNowEpoc = 1567161300;

    it('return value as is if given a number', () => {
        expect(normalizeTime(1567161373419, fakeNow)).toBe(1567161373.419);
        expect(normalizeTime(0, fakeNow)).toBe(0);
    });

    it('parses the given iso date string', () => {
        expect(normalizeTime('2019-08-30T10:38:47.665Z', fakeNow)).toBe(1567161527.665);
        expect(normalizeTime('2019-08-29T21:31:56.816Z', fakeNow)).toBe(1567114316.816);
    });

    it('return sthe current time if given an invalid date string', () => {
        expect(normalizeTime('foobar', fakeNow, false)).toBe(fakeNowEpoc);
        expect(normalizeTime('1', fakeNow, false)).toBe(fakeNowEpoc);
        expect(normalizeTime('2019-10-15', fakeNow, false)).toBe(fakeNowEpoc);
        expect(normalizeTime('2019-10', fakeNow, false)).toBe(fakeNowEpoc);
        expect(normalizeTime('', fakeNow, false)).toBe(fakeNowEpoc);
    });

    it('returns the current time if given null-ish value', () => {
        expect(normalizeTime(null, fakeNow)).toBe(fakeNowEpoc);
        expect(normalizeTime(undefined, fakeNow)).toBe(fakeNowEpoc);
    });
});

import { convertBuffersToHex } from '../src/output';

describe('convertBuffersToHex', () => {
    it('should return an object without buffers as-is', () => {
        expect(
            convertBuffersToHex({
                foo: 'bar',
                some: 'thing',
                anumber: 3,
                so: true,
            })
        ).toMatchInlineSnapshot(`
            Object {
              "anumber": 3,
              "foo": "bar",
              "so": true,
              "some": "thing",
            }
        `);
    });

    it('should modify an object property containing a buffer', () => {
        expect(
            convertBuffersToHex({
                some: Buffer.from('foobar'),
            })
        ).toMatchInlineSnapshot(`
            Object {
              "some_hex": "666f6f626172",
            }
        `);
    });

    it('should convert an array of buffers to inline objects with the hex values', () => {
        expect(
            convertBuffersToHex({
                args: [Buffer.from('foobar'), Buffer.from('hello'), Buffer.from('world')],
            })
        ).toMatchInlineSnapshot(`
            Object {
              "args": Array [
                Object {
                  "hex": "666f6f626172",
                },
                Object {
                  "hex": "68656c6c6f",
                },
                Object {
                  "hex": "776f726c64",
                },
              ],
            }
        `);
    });
});

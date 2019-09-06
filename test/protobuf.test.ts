import {
    decodeSignaturePolicyEnvolope,
    decodeChaincodeDeploymentSpec,
    decodeChainCodeAction,
    isSignaturePolicyEnvolope,
} from '../src/protobuf';

test('decodeChainCodeAction', () => {
    expect(decodeChainCodeAction(Buffer.from('120612046c736363', 'hex'))).toMatchInlineSnapshot(`
        Object {
          "chaincodeId": null,
          "events": Object {
            "data": Array [
              18,
              4,
              108,
              115,
              99,
              99,
            ],
            "type": "Buffer",
          },
          "response": null,
          "results": Object {
            "data": Array [],
            "type": "Buffer",
          },
        }
    `);
});

test('decodeChaincodeDeploymentSpec', () => {
    const buf1 = Buffer.from('0a1e08011216120f686967682d7468726f7567687075741a03312e301a020a00', 'hex');
    const buf2 = Buffer.from('0a1b0801120f1209736d616c6c62616e6b1a0276301a060a04696e6974', 'hex');
    expect(decodeChaincodeDeploymentSpec(buf1)).toMatchInlineSnapshot(`
        Object {
          "chaincodeSpec": Object {
            "chaincodeId": Object {
              "name": "high-throughput",
              "path": "",
              "version": "1.0",
            },
            "input": Object {
              "args": Array [
                Object {
                  "data": Array [],
                  "type": "Buffer",
                },
              ],
              "decorations": Object {},
            },
            "timeout": 0,
            "type": "GOLANG",
          },
          "codePackage": Object {
            "data": Array [],
            "type": "Buffer",
          },
          "execEnv": "DOCKER",
        }
    `);
    expect(decodeChaincodeDeploymentSpec(buf2)).toMatchInlineSnapshot(`
        Object {
          "chaincodeSpec": Object {
            "chaincodeId": Object {
              "name": "smallbank",
              "path": "",
              "version": "v0",
            },
            "input": Object {
              "args": Array [
                Object {
                  "data": Array [
                    105,
                    110,
                    105,
                    116,
                  ],
                  "type": "Buffer",
                },
              ],
              "decorations": Object {},
            },
            "timeout": 0,
            "type": "GOLANG",
          },
          "codePackage": Object {
            "data": Array [],
            "type": "Buffer",
          },
          "execEnv": "DOCKER",
        }
    `);
});

test('decodeSignaturePolicyEnvolope', async () => {
    const buf = Buffer.from(
        '1210120e08031202080012020801120208021a0f120d0a0b41746c616e7469734d53501a0c120a0a084b617267614d53501a11120f0a0d4e65766572677265656e4d5350',
        'hex'
    );
    const decoded = decodeSignaturePolicyEnvolope(buf);
    expect(decoded).toMatchInlineSnapshot(`
        Object {
          "identities": Array [
            Object {
              "principal": Object {
                "mspIdentifier": "AtlantisMSP",
                "role": "MEMBER",
              },
              "principalClassification": "ROLE",
            },
            Object {
              "principal": Object {
                "mspIdentifier": "KargaMSP",
                "role": "MEMBER",
              },
              "principalClassification": "ROLE",
            },
            Object {
              "principal": Object {
                "mspIdentifier": "NevergreenMSP",
                "role": "MEMBER",
              },
              "principalClassification": "ROLE",
            },
          ],
          "rule": Object {
            "Type": "nOutOf",
            "nOutOf": Object {
              "n": 3,
              "rules": Array [
                Object {
                  "Type": "signedBy",
                  "signedBy": 0,
                },
                Object {
                  "Type": "signedBy",
                  "signedBy": 1,
                },
                Object {
                  "Type": "signedBy",
                  "signedBy": 2,
                },
              ],
            },
          },
          "version": 0,
        }
    `);

    expect(isSignaturePolicyEnvolope(buf)).toBe(true);
});

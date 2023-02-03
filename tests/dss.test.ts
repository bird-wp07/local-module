import { makeDssClient } from "./testsHelper"
import * as fs from "fs"
import { describe, test } from "mocha"
import { expect } from "chai"
import chai from "chai"
import chaiSubset from "chai-subset"
import * as Dss from "../src/dss"
import { ESignatureValidationIndication, ESignatureValidationSubIndication, IValidateSignatureRequest, IValidateSignatureResponse } from "../src/dss/types"

chai.use(chaiSubset)

describe("Dss", () => {
    describe("DssClient", () => {
        let dssClient: Dss.DssClient
        before("Init", async () => {
            dssClient = await makeDssClient()
        })

        describe("#validateSignature()", () => {
            test.skip("handles a valid QES-signed PDF correctly", async () => {
                const originalFileB64 = fs.readFileSync(`./assets/TODO.pdf`).toString("base64")
                const request: IValidateSignatureRequest = {
                    signedDocument: {
                        bytes: originalFileB64,
                        digestAlgorithm: null
                    },
                    originalDocuments: [],
                    policy: null,
                    signatureId: null
                }
                const have = (await dssClient.validateSignature(request))._unsafeUnwrap()
                const want: IValidateSignatureResponse = {
                    SimpleReport: {
                        signatureOrTimestamp: [
                            {
                                Signature: {
                                    Indication: ESignatureValidationIndication.TOTAL_PASSED,
                                    SubIndication: null
                                }
                            }
                        ]
                    }
                }
                expect(have).to.containSubset(want)
            })

            test("handles a self-signed PDF correctly", async () => {
                const originalFileB64 = fs.readFileSync("./assets/selfsigned-js.pdf").toString("base64")
                const request: IValidateSignatureRequest = {
                    signedDocument: {
                        bytes: originalFileB64,
                        digestAlgorithm: null
                    },
                    originalDocuments: [],
                    policy: null,
                    signatureId: null
                }
                const have = (await dssClient.validateSignature(request))._unsafeUnwrap()
                const want: IValidateSignatureResponse = {
                    SimpleReport: {
                        signatureOrTimestamp: [
                            {
                                Signature: {
                                    Indication: ESignatureValidationIndication.INDETERMINATE,
                                    SubIndication: ESignatureValidationSubIndication.NO_CERTIFICATE_CHAIN_FOUND
                                }
                            }
                        ]
                    }
                }
                expect(have).to.containSubset(want)
            })

            test("handles a self-signed, detached signature correctly", async () => {
                const originalFileB64 = fs.readFileSync(`./assets/sample.xml`).toString("base64")
                const sidecarSignatureFileB64 = fs.readFileSync(`./assets/sample-xades-detached.xml`).toString("base64")
                const request: IValidateSignatureRequest = {
                    signedDocument: {
                        bytes: sidecarSignatureFileB64,
                        digestAlgorithm: null,
                        name: "sample-detached.xml"
                    },
                    originalDocuments: [
                        {
                            bytes: originalFileB64,
                            digestAlgorithm: null,
                            name: "sample.xml"
                        }
                    ],
                    policy: null,
                    signatureId: null
                }
                const have = (await dssClient.validateSignature(request))._unsafeUnwrap()
                const want: IValidateSignatureResponse = {
                    SimpleReport: {
                        signatureOrTimestamp: [
                            {
                                Signature: {
                                    Indication: ESignatureValidationIndication.INDETERMINATE,
                                    SubIndication: ESignatureValidationSubIndication.NO_CERTIFICATE_CHAIN_FOUND
                                }
                            }
                        ]
                    }
                }
                expect(have).to.containSubset(want)
            })

            test("handles a corrupted self-signed, detached signature correctly", async () => {
                const originalFileB64 = fs.readFileSync(`./assets/sample.xml`).toString("base64")
                const corruptedFileB64 = "/" + originalFileB64.slice(1)
                const sidecarSignatureFileB64 = fs.readFileSync(`./assets/sample-xades-detached.xml`).toString("base64")
                const request: IValidateSignatureRequest = {
                    signedDocument: {
                        bytes: sidecarSignatureFileB64,
                        digestAlgorithm: null,
                        name: "sample-detached.xml"
                    },
                    originalDocuments: [
                        {
                            bytes: corruptedFileB64,
                            digestAlgorithm: null,
                            name: "sample.xml"
                        }
                    ],
                    policy: null,
                    signatureId: null
                }
                const have = (await dssClient.validateSignature(request))._unsafeUnwrap()
                const want: IValidateSignatureResponse = {
                    SimpleReport: {
                        signatureOrTimestamp: [
                            {
                                Signature: {
                                    Indication: ESignatureValidationIndication.TOTAL_FAILED,
                                    SubIndication: ESignatureValidationSubIndication.HASH_FAILURE
                                }
                            }
                        ]
                    }
                }
                expect(have).to.containSubset(want)
            })

            test("seems to not differentiate between the 'null' value and an empty digestAlgorithm field", async () => {
                const originalFileB64 = fs.readFileSync(`./assets/sample.xml`).toString("base64")
                const sidecarSignatureFileB64 = fs.readFileSync(`./assets/sample-xades-detached.xml`).toString("base64")
                const signedDocuments = [
                    {
                        bytes: sidecarSignatureFileB64,
                        digestAlgorithm: null,
                        name: "xades-detached.xml"
                    },
                    {
                        bytes: sidecarSignatureFileB64,
                        name: "xades-detached.xml"
                    }
                ]

                const responses: IValidateSignatureResponse[] = []
                for (const signedDocument of signedDocuments) {
                    const request: IValidateSignatureRequest = {
                        signedDocument: signedDocument,
                        originalDocuments: [
                            {
                                bytes: originalFileB64,
                                digestAlgorithm: null,
                                name: "sample.xml"
                            }
                        ],
                        policy: null,
                        signatureId: null
                    }
                    const response = (await dssClient.validateSignature(request))._unsafeUnwrap()
                    responses.push(response)
                }

                expect(responses[0]).to.deep.equal(responses[1])
            })
        })
    })

    describe("Utils", () => {
        test("parseCms", () => {
            const cmsBuf = fs.readFileSync("./tests/files/input-001.cms")
            const have = Dss.Utils.parseCms(cmsBuf)
            const want = {
                digestAlgorithm: Dss.EDigestAlgorithm.SHA256,
                signatureAlgorithm: Dss.ESignatureAlgorithm.ECDSA_SHA256,
                signatureValue: "MEUCIFhbM41n2RkK9TR9jOe1BR61sN4g+tYwAm07tSRU3iXrAiEAqiV+oms5IFEr/9+djfeGqeqYcUT97ZAXO5jZ+M1u7k4=",
                certificateChain: [
                    {
                        encodedCertificate:
                            "MIIB1DCCAXugAwIBAgIEY4C1DDAKBggqhkjOPQQDAjBmMQswCQYDVQQGEwJERTEVMBMGA1UECAwMQnVuZGVzbGFuZCBBMR0wGwYDVQQKDBRCSVJEIFdQNyBERVZFTE9QTUVOVDEhMB8GA1UEAwwYTGFuZGVzZWJlbmUgQnVuZGVzbGFuZCBBMB4XDTIyMTEyNTEyMjkwMFoXDTIzMTEyNTEyMjkwMFowbjELMAkGA1UEBhMCREUxFTATBgNVBAgMDEJ1bmRlc2xhbmQgQTEQMA4GA1UEBwwHU3RhZHQgQTEdMBsGA1UECgwUQklSRCBXUDcgREVWRUxPUE1FTlQxFzAVBgNVBAMMDlNjaHVsZSBTdGFkdCBBMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEHMh6b8XLNAFkRsruRSc3dKnBYIga/B9Y+6C3oFFLXOlHmksAW8k/ijyH8acNDqD4E/iUliLkZnGNKS9eHEIzkqMPMA0wCwYDVR0PBAQDAgeAMAoGCCqGSM49BAMCA0cAMEQCIHVtsFV5mohFVgXz92OlEg//AgcAJTxcohp0U8LMVAp6AiARpUdrFxLqyTZdHT7lA74ggdR9Sxun5gFDhXF86jBk7g=="
                    },
                    {
                        encodedCertificate:
                            "MIIB/TCCAaSgAwIBAgIEY4C0zzAKBggqhkjOPQQDAjBDMQswCQYDVQQGEwJERTEdMBsGA1UECgwUQklSRCBXUDcgREVWRUxPUE1FTlQxFTATBgNVBAMMDEJ1bmRlcy1FYmVuZTAeFw0yMjExMjUxMjI3NTlaFw0yMzExMjUxMjI3NTlaMGYxCzAJBgNVBAYTAkRFMRUwEwYDVQQIDAxCdW5kZXNsYW5kIEExHTAbBgNVBAoMFEJJUkQgV1A3IERFVkVMT1BNRU5UMSEwHwYDVQQDDBhMYW5kZXNlYmVuZSBCdW5kZXNsYW5kIEEwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAASay9nvfkPyQQNwXgJJ10S18ZkaVUz/qQP2F4v2ny3kTlBb9vpIsAX4SSALgzCSuch3btpD+gMlkK/Y9t2Z40QUo2MwYTAPBgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIBBjAfBgNVHSMEGDAWgBS1EialImTqj6gadUcAdO5pyIvTpzAdBgNVHQ4EFgQUlrmb2Rs4He2O21l30YiBBA2b5GkwCgYIKoZIzj0EAwIDRwAwRAIgQqL1ywZAORBb2qdDovmy9VBTLWh1oG2tE6SatevRkdECICwYRHF/4pWO0A1pinFgFVHpXzwRw+JSwqVIpF9IjAcU"
                    },
                    {
                        encodedCertificate:
                            "MIIB2zCCAYGgAwIBAgIEY4C0lDAKBggqhkjOPQQDAjBDMQswCQYDVQQGEwJERTEdMBsGA1UECgwUQklSRCBXUDcgREVWRUxPUE1FTlQxFTATBgNVBAMMDEJ1bmRlcy1FYmVuZTAeFw0yMjExMjUxMjI3MDBaFw0yMzExMjUxMjI3MDBaMEMxCzAJBgNVBAYTAkRFMR0wGwYDVQQKDBRCSVJEIFdQNyBERVZFTE9QTUVOVDEVMBMGA1UEAwwMQnVuZGVzLUViZW5lMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE3hVD1kxWl+aTnEuXolgmldIMr02Sh2eK0N78umJEJwu/fUxDqpFKGmBIbdX/BcTSTAKnTLw4MGwHYywIfyflWKNjMGEwDwYDVR0TAQH/BAUwAwEB/zAOBgNVHQ8BAf8EBAMCAQYwHwYDVR0jBBgwFoAUtRImpSJk6o+oGnVHAHTuaciL06cwHQYDVR0OBBYEFLUSJqUiZOqPqBp1RwB07mnIi9OnMAoGCCqGSM49BAMCA0gAMEUCIQCQgjC8uY0Rg29+IqfzRPZ3BrkCqZGenoU3fBG5AeqLnQIgQ9vTu1RGtMQZFVg8BUcOFOsqHO6VYeU0pULq5uG1Urg="
                    }
                ],
                signingCertificate: {
                    encodedCertificate:
                        "MIIB1DCCAXugAwIBAgIEY4C1DDAKBggqhkjOPQQDAjBmMQswCQYDVQQGEwJERTEVMBMGA1UECAwMQnVuZGVzbGFuZCBBMR0wGwYDVQQKDBRCSVJEIFdQNyBERVZFTE9QTUVOVDEhMB8GA1UEAwwYTGFuZGVzZWJlbmUgQnVuZGVzbGFuZCBBMB4XDTIyMTEyNTEyMjkwMFoXDTIzMTEyNTEyMjkwMFowbjELMAkGA1UEBhMCREUxFTATBgNVBAgMDEJ1bmRlc2xhbmQgQTEQMA4GA1UEBwwHU3RhZHQgQTEdMBsGA1UECgwUQklSRCBXUDcgREVWRUxPUE1FTlQxFzAVBgNVBAMMDlNjaHVsZSBTdGFkdCBBMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEHMh6b8XLNAFkRsruRSc3dKnBYIga/B9Y+6C3oFFLXOlHmksAW8k/ijyH8acNDqD4E/iUliLkZnGNKS9eHEIzkqMPMA0wCwYDVR0PBAQDAgeAMAoGCCqGSM49BAMCA0cAMEQCIHVtsFV5mohFVgXz92OlEg//AgcAJTxcohp0U8LMVAp6AiARpUdrFxLqyTZdHT7lA74ggdR9Sxun5gFDhXF86jBk7g=="
                }
            }
            expect(have).to.deep.equal(want)
        })
    })
})

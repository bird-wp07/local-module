import { makeDssClient } from "./testsHelper"
import * as fs from "fs"
import { describe, test } from "mocha"
import { expect } from "chai"
import chai from "chai"
import chaiSubset from "chai-subset"
import * as Dss from "../src/dss"
import { ESignatureValidationIndication, ESignatureValidationSubIndication, IValidateSignatureRequest, IValidateSignatureResponse } from "../src/dss/types"
import { Base64 } from "../src/types"

chai.use(chaiSubset)

describe("Dss", () => {
    describe("HTTP API Sanity Checks", () => {
        let dssClient: Dss.DssClient
        before("Init", async () => {
            dssClient = await makeDssClient()
        })

        describe("DssClient#getDataToSign()", () => {
            // ???: DSS implicitly hashes the PDF's bytes AND a timestamp.
            //      Why? Which bytes are exactly hashed? Is this an existing standard?
            test("generate SHA256 digest of a PDF+timestamp", async () => {
                const pdf: Base64 = fs.readFileSync("./tests/files/unsigned.pdf").toString("base64")
                const request: Dss.IGetDataToSignRequest = {
                    toSignDocument: {
                        bytes: pdf
                    },
                    parameters: {
                        digestAlgorithm: Dss.EDigestAlgorithm.SHA256,
                        signatureLevel: Dss.ESignatureLevel.PAdES_B,
                        generateTBSWithoutCertificate: true,
                        blevelParams: {
                            signingDate: Number(new Date("2022-11-25T12:30:00Z"))
                        }
                    }
                }
                const have: Dss.IGetDataToSignResponse = (await dssClient.getDataToSign(request))._unsafeUnwrap()
                const want: Dss.IGetDataToSignResponse = {
                    bytes: "MUswGAYJKoZIhvcNAQkDMQsGCSqGSIb3DQEHATAvBgkqhkiG9w0BCQQxIgQgHo3ZE65djFgt13EWvWawopwZIARH4JjjdCA1FB42Tko="
                }
                expect(have).to.deep.equal(want)
            })
        })

        describe.skip("TODO; DssClient#signDocument()", () => {
            test("embed an enveloped signature into a PDF", () => {
                "TODO;"
            })
        })

        describe("DssClient#validateSignature()", () => {
            test.skip("handles a valid QES-signed PDF correctly", async () => {
                const doc: Base64 = fs.readFileSync(`./assets/TODO.pdf`).toString("base64")
                const request: IValidateSignatureRequest = {
                    signedDocument: {
                        bytes: doc,
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
                const pdf = fs.readFileSync("./assets/selfsigned-js.pdf").toString("base64")
                const request: IValidateSignatureRequest = {
                    signedDocument: {
                        bytes: pdf,
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
        })
    })

    describe("Utils", () => {
        test("parseCms()", () => {
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

import { makeDssClient } from "./testsHelper"
import * as fs from "fs"
import { describe, test } from "mocha"
import { expect } from "chai"
import chai from "chai"
import chaiSubset from "chai-subset"
import * as Dss from "../src/dss"

chai.use(chaiSubset)

describe("Dss", () => {
    describe("API Sanity Checks", () => {
        let dssClient: Dss.DssClient
        before("Init", async () => {
            dssClient = await makeDssClient()
        })

        describe("DssClient#getDataToSign()", () => {
            test.skip("TODO; generate SHA256 digest of a combined PDF/timestamp", () => {
                return
            })
        })

        describe("DssClient#validateSignature()", () => {
            test.skip("TODO; handles a valid QES-signed PDF correctly", () => {
                return
            })

            test("handles a self-signed PDF correctly", async () => {
                const pdf = fs.readFileSync("./tests/files/selfsigned-js.pdf").toString("base64")
                const request: Dss.IValidateSignatureRequest = {
                    signedDocument: {
                        bytes: pdf,
                        digestAlgorithm: null
                    },
                    originalDocuments: [],
                    policy: null,
                    signatureId: null
                }
                const have = (await dssClient.validateSignature(request))._unsafeUnwrap()
                const want = {
                    SimpleReport: {
                        signatureOrTimestamp: [
                            {
                                Signature: {
                                    Indication: Dss.ESignatureValidationIndication.INDETERMINATE,
                                    SubIndication: Dss.ESignatureValidationSubIndication.NO_CERTIFICATE_CHAIN_FOUND
                                }
                            }
                        ]
                    }
                    // TODO: check diagnostic data field
                }
                expect(have).to.containSubset(want)
            })
        })

        describe("DssClient#signDocument()", () => {
            test.skip("TODO;", () => {
                return
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

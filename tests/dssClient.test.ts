import { createHash } from "node:crypto"
import fs from "fs"
import { describe, test } from "mocha"
import { expect } from "chai"
import chai from "chai"
import chaiSubset from "chai-subset"
import * as Dss from "../src/dss/"
import {
    EDigestAlgorithm,
    ESignatureLevel,
    ESignaturePackaging,
    ESignatureValidationIndication,
    ESignatureValidationSubIndication,
    IGetDataToSignRequest,
    IValidateSignatureRequest,
    IValidateSignatureResponse
} from "../src/dss/types"

chai.use(chaiSubset)

const dssBaseUrl = process.env.DSS_BASEURL ?? "http://127.0.0.1:8080"

describe(Dss.DssClient.name, () => {
    const dssClient = new Dss.DssClient(dssBaseUrl)
    before("Verify DSS is online", async () => {
        if ((await dssClient.isOnline()).isErr()) {
            throw new Error("DSS cannot be reached.")
        }
    })

    describe("#getDataToSign()", () => {
        for (const filename of ["books.xml", "sheep.jpg"]) {
            test(`produces a correct SHA256 hash of '${filename}'`, async () => {
                const bytes = fs.readFileSync(`./assets/${filename}`)
                const request: IGetDataToSignRequest = {
                    parameters: {
                        signatureLevel: ESignatureLevel.XAdES_B,
                        digestAlgorithm: EDigestAlgorithm.SHA256,
                        signaturePackaging: ESignaturePackaging.enveloping,
                        generateTBSWithoutCertificate: true
                    },
                    toSignDocument: {
                        bytes: bytes.toString("base64")
                    }
                }
                const response = (await dssClient.getDataToSign(request))._unsafeUnwrap()
                const xmldsig = Buffer.from(response.bytes, "base64").toString("utf8")
                const have = await Dss.getDigestValueFromXmldsig(xmldsig)
                const want = createHash("sha256").update(bytes).digest("base64")
                expect(have).to.equal(want)
            })
        }
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

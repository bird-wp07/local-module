import { makeDssClient } from "./testsHelper"
import { createHash } from "node:crypto"
import fs from "fs"
import { describe, test } from "mocha"
import { expect } from "chai"
import chai from "chai"
import chaiSubset from "chai-subset"
import { GetDataToSignRequest, ValidateSignedDocumentRequest, ValidateSignedDocumentResponse } from "../src/server/services"
import { EDigestAlgorithm, ESignatureLevel, ESignaturePackaging, EValidationSteps } from "../src/types/common"
import { DssClient, ESignatureValidationIndication, ESignatureValidationSubIndication } from "../src/clients/dss"
import { getDigestValueFromXmldsig } from "../src/clients/dss"

chai.use(chaiSubset)

describe(DssClient.name, () => {
    let dssClient: DssClient
    before("Init", async () => {
        dssClient = await makeDssClient()
    })

    describe("#getDataToSign()", () => {
        for (const filename of ["books.xml", "sheep.jpg"]) {
            test(`produces a correct SHA256 hash of '${filename}'`, async () => {
                const bytes = fs.readFileSync(`./assets/${filename}`)
                const request: GetDataToSignRequest = {
                    signatureLevel: ESignatureLevel.XAdES_B,
                    digestAlgorithm: EDigestAlgorithm.SHA256,
                    signaturePackaging: ESignaturePackaging.ENVELOPING,
                    bytes: bytes.toString("base64")
                }
                const response = await dssClient.getDataToSign(request)
                expect(response.isOk()).to.be.true
                const data = response._unsafeUnwrap()
                const xmldsig = Buffer.from(data.digest, "base64").toString("utf8")
                const have = await getDigestValueFromXmldsig(xmldsig)
                const want = createHash("sha256").update(bytes).digest("base64")
                expect(have).to.equal(want)
            })
        }
    })

    describe("#validateSignature()", () => {
        test.skip("handles a valid QES-signed PDF correctly", async () => {
            const originalFileB64 = fs.readFileSync(`./assets/TODO.pdf`).toString("base64")
            const request: ValidateSignedDocumentRequest = {
                signedDocument: {
                    bytes: originalFileB64
                }
            }
            const have = (await dssClient.validate(request))._unsafeUnwrap()
            const want: ValidateSignedDocumentResponse = {
                results: [
                    {
                        validationStep: EValidationSteps.SIGNATURE,
                        passed: true,
                        reason: null
                    }
                ]
            }
            expect(have).to.containSubset(want)
        })

        test("handles a self-signed PDF correctly", async () => {
            const originalFileB64 = fs.readFileSync("./assets/selfsigned-js.pdf").toString("base64")
            const request: ValidateSignedDocumentRequest = {
                signedDocument: {
                    bytes: originalFileB64
                }
            }
            const have = (await dssClient.validate(request))._unsafeUnwrap()
            const want: ValidateSignedDocumentResponse = {
                results: [
                    {
                        validationStep: EValidationSteps.SIGNATURE,
                        passed: false,
                        reason: ESignatureValidationSubIndication.NO_CERTIFICATE_CHAIN_FOUND
                    }
                ]
            }

            expect(have).to.containSubset(want)
        })

        test("handles a self-signed, detached signature correctly", async () => {
            const originalFileB64 = fs.readFileSync(`./assets/sample.xml`).toString("base64")
            const sidecarSignatureFileB64 = fs.readFileSync(`./assets/sample-xades-detached.xml`).toString("base64")
            const request: ValidateSignedDocumentRequest = {
                signedDocument: {
                    bytes: sidecarSignatureFileB64,
                    name: "sample-detached.xml"
                },
                originalDocuments: [
                    {
                        bytes: originalFileB64,
                        name: "sample.xml"
                    }
                ]
            }
            const have = (await dssClient.validate(request))._unsafeUnwrap()
            const want: ValidateSignedDocumentResponse = {
                results: [
                    {
                        validationStep: EValidationSteps.SIGNATURE,
                        passed: false,
                        reason: ESignatureValidationSubIndication.NO_CERTIFICATE_CHAIN_FOUND
                    }
                ]
            }

            expect(have).to.containSubset(want)
        })

        test("handles a corrupted self-signed, detached signature correctly", async () => {
            const originalFileB64 = fs.readFileSync(`./assets/sample.xml`).toString("base64")
            const corruptedFileB64 = "/" + originalFileB64.slice(1)
            const sidecarSignatureFileB64 = fs.readFileSync(`./assets/sample-xades-detached.xml`).toString("base64")
            const request: ValidateSignedDocumentRequest = {
                signedDocument: {
                    bytes: sidecarSignatureFileB64,
                    name: "sample-detached.xml"
                },
                originalDocuments: [
                    {
                        bytes: corruptedFileB64,
                        name: "sample.xml"
                    }
                ]
            }
            const have = (await dssClient.validate(request))._unsafeUnwrap()
            const want: ValidateSignedDocumentResponse = {
                results: [
                    {
                        validationStep: EValidationSteps.SIGNATURE,
                        passed: false,
                        reason: ESignatureValidationSubIndication.HASH_FAILURE
                    }
                ]
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

            const responses: ValidateSignedDocumentResponse[] = []
            for (const signedDocument of signedDocuments) {
                const request: ValidateSignedDocumentRequest = {
                    signedDocument: signedDocument,
                    originalDocuments: [
                        {
                            bytes: originalFileB64,
                            name: "sample.xml"
                        }
                    ]
                }
                const response = (await dssClient.validate(request))._unsafeUnwrap()
                responses.push(response)
            }

            expect(responses[0]).to.deep.equal(responses[1])
        })
    })
})

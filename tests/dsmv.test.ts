import { expect } from "chai"
import { describe, test } from "mocha"
import * as fs from "fs"
import * as Cs from "../src/clients/cs"
import { findLm, makeCsClient, makeDssClient } from "./testsHelper"
import { httpReq } from "../src/utility"
import * as Dss from "../src/clients/dss"
import { DigestPDFRequest, MergePDFRequest, ValidateSignedPdfRequest, ValidateSignedPdfResponse } from "../src/server/controllers/types"
import { EDigestAlgorithm } from "../src/types/common"
import { ApplicationService } from "../src/server/services"

describe("Digest, Sign, Merge, Verify", () => {
    // NOTE: The signing certificate used by the cs is valid
    //       from 2022-11-25T12:29:00Z to 2023-11-25T12:29:00Z
    let dssClient: Dss.DssClient
    let csClient: Cs.CsClient
    let service: ApplicationService
    before("Init", async () => {
        dssClient = await makeDssClient()
        csClient = await makeCsClient()
        service = new ApplicationService(dssClient)
    })

    for (const pdfpath of ["./assets/unsigned.pdf", "./assets/Test5.pdf", "./assets/Test6.pdf", "./assets/Test7.pdf"]) {
        test(`Happy path for ${pdfpath}`, async () => {
            const timestampUnixms = Number(new Date("2022-11-25T12:30:00Z"))
            const pdfBase64 = fs.readFileSync(pdfpath).toString("base64")
            const digestPdfRequest: DigestPDFRequest = {
                bytes: pdfBase64,
                digestAlgorithm: EDigestAlgorithm.SHA256,
                signingTimestamp: timestampUnixms
            }
            const digestPdfRes = await service.createDigestForPDF(digestPdfRequest)
            expect(digestPdfRes.isErr()).to.be.false
            const digest = digestPdfRes._unsafeUnwrap().digest

            const exampleSignatureRequest: Cs.ISignatureRequest = {
                auditLog: "Signing of Test Document",
                issuerId: "ID-OF-YOUR-KEY",
                hash: digest,
                digestMethod: "SHA256"
            }
            const getSignedCmsRes = await Cs.csClient.getSignedCms(exampleSignatureRequest)
            expect(getSignedCmsRes.isErr()).to.be.false
            const signedCms = getSignedCmsRes._unsafeUnwrap()
            const cms = signedCms.cms

            const mergePdfRequest: MergePDFRequest = {
                bytes: pdfBase64,
                signatureAsCMS: cms,
                signingTimestamp: timestampUnixms
            }
            const mergePdfRes = await service.mergePDF(mergePdfRequest)
            expect(mergePdfRes.isErr()).to.be.false
            const signedPdfBase64 = mergePdfRes._unsafeUnwrap()

            const validateSignatureRequest: ValidateSignedPdfRequest = {
                bytes: signedPdfBase64.bytes
            }
            // COMBAK: Add authorization check to validation eventually.
            const validationResult = await service.validatePDFSignature(validateSignatureRequest)
            expect(validationResult.isErr()).to.be.false
            const have = validationResult._unsafeUnwrap()
            // COMBAK: Adjust result and reason once the cs root certificate's metadata is complete.
            //         See #27
            const want: ValidateSignedPdfResponse = {
                result: Dss.ESignatureValidationIndication.INDETERMINATE,
                reason: Dss.ESignatureValidationSubIndication.TRY_LATER
            }
            expect(have).to.deep.equal(want)
        })
    }

    test("Merging a signature based on an expired certificate doesn't work", async () => {
        const timestampUnixms = Number(new Date("2028-01-01T12:30:00Z"))
        const pdfBase64 = fs.readFileSync("./assets/unsigned.pdf").toString("base64")
        const digestPdfRequest: DigestPDFRequest = {
            bytes: pdfBase64,
            digestAlgorithm: EDigestAlgorithm.SHA256,
            signingTimestamp: timestampUnixms
        }
        const digestPdfRes = await service.createDigestForPDF(digestPdfRequest)
        expect(digestPdfRes.isErr()).to.be.false
        const digest = digestPdfRes._unsafeUnwrap().digest

        const exampleSignatureRequest: Cs.ISignatureRequest = {
            auditLog: "Signing of Test Document",
            issuerId: "ID-OF-YOUR-KEY",
            hash: digest,
            digestMethod: "SHA256"
        }
        const getSignedCmsRes = await csClient.getSignedCms(exampleSignatureRequest)
        expect(getSignedCmsRes.isErr()).to.be.false
        const signedCms = getSignedCmsRes._unsafeUnwrap()
        const cms = signedCms.cms

        const mergePdfRequest: MergePDFRequest = {
            bytes: pdfBase64,
            signatureAsCMS: cms,
            signingTimestamp: timestampUnixms
        }
        const mergePdfRes = await service.mergePDF(mergePdfRequest)
        expect(mergePdfRes.isErr()).to.be.true
        expect(mergePdfRes._unsafeUnwrapErr()).to.be.instanceOf(Dss.CertificateExpired)
    })

    test("Merging a signature based on a not-yet-valid certificate doesn't work", async () => {
        const timestampUnixms = Number(new Date("2021-01-01T12:30:00Z"))
        const pdfBase64 = fs.readFileSync("./assets/unsigned.pdf").toString("base64")
        const digestPdfRequest: DigestPDFRequest = {
            bytes: pdfBase64,
            digestAlgorithm: EDigestAlgorithm.SHA256,
            signingTimestamp: timestampUnixms
        }
        const digestPdfRes = await service.createDigestForPDF(digestPdfRequest)
        expect(digestPdfRes.isErr()).to.be.false
        const digest = digestPdfRes._unsafeUnwrap().digest

        const exampleSignatureRequest: Cs.ISignatureRequest = {
            auditLog: "Signing of TestDocument",
            issuerId: "ID-OF-YOUR-KEY",
            hash: digest,
            digestMethod: "SHA256"
        }
        const getSignedCmsRes = await csClient.getSignedCms(exampleSignatureRequest)
        expect(getSignedCmsRes.isErr()).to.be.false
        const signedCms = getSignedCmsRes._unsafeUnwrap()
        const cms = signedCms.cms

        const mergePdfRequest: MergePDFRequest = {
            bytes: pdfBase64,
            signatureAsCMS: cms,
            signingTimestamp: timestampUnixms
        }
        const mergePdfRes = await service.mergePDF(mergePdfRequest)
        expect(mergePdfRes.isErr()).to.be.true
        expect(mergePdfRes._unsafeUnwrapErr()).to.be.instanceOf(Dss.CertificateNotYetValid)
    })
})

describe("Digest, Sign, Merge, Verify via HTTP APIs", () => {
    /* eslint-disable */
    // NOTE: The signing certificate used by the cs is valid
    //       from 2022-11-25T12:29:00Z to 2023-11-25T12:29:00Z
    let lmBaseUrl: string
    let csClient: CsClient
    before("Init", async () => {
        lmBaseUrl = await findLm()
        csClient = await makeCsClient()
    })

    for (const pdfpath of ["./assets/unsigned.pdf", "./assets/Test5.pdf", "./assets/Test6.pdf", "./assets/Test7.pdf"]) {
        const timestampMs = Number(new Date("2022-11-26T12:00:00Z"))
        test(`Happy path for ${pdfpath}`, async () => {
            const pdfBase64 = fs.readFileSync(pdfpath).toString("base64")
            const resDigest = await httpReq({
                method: "POST",
                baseURL: lmBaseUrl,
                url: "/digest/pdf",
                data: {
                    digestAlgorithm: "SHA256",
                    bytes: pdfBase64,
                    signingTimestamp: timestampMs
                }
            })
            expect(resDigest.isErr()).to.be.false
            const digest = resDigest._unsafeUnwrap().data.digest

            const resSign = await httpReq({
                method: "POST",
                baseURL: csClient.baseUrl,
                url: "/api/v1/signer/issuances",
                data: {
                    auditLog: "Signing of TestDocument",
                    issuerId: "ID-OF-YOUR-KEY",
                    hash: digest,
                    digestMethod: "SHA256"
                }
            })
            expect(resSign.isErr()).to.be.false
            const cms = resSign._unsafeUnwrap().data.cms

            const resMerge = await httpReq({
                method: "POST",
                baseURL: lmBaseUrl,
                url: "/merge/pdf",
                data: {
                    bytes: pdfBase64,
                    signatureAsCMS: cms,
                    signingTimestamp: timestampMs
                }
            })
            expect(resMerge.isErr()).to.be.false
            const signedPdf = resMerge._unsafeUnwrap().data.bytes

            const resValidate = await httpReq({
                method: "POST",
                baseURL: lmBaseUrl,
                url: "/validate/pdf",
                data: {
                    bytes: signedPdf
                }
            })
            expect(resValidate.isErr()).to.be.false
            const validationResult = resValidate._unsafeUnwrap().data
            expect(validationResult).to.deep.equal({
                result: Dss.ESignatureValidationIndication.INDETERMINATE,
                reason: Dss.ESignatureValidationSubIndication.TRY_LATER
            })
        })
    }
    /* eslint-enable */
})

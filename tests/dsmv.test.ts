import chai, { expect } from "chai"
import chaiSubset from "chai-subset"
import { describe, test } from "mocha"
import * as fs from "fs"
import * as Cs from "../src/cs"
import * as Dss from "../src/dss"
import * as Server from "../src/server"
import { findLm, makeCsClient, makeDssClient } from "./testsHelper"
import { httpReq } from "../src/utility"

chai.use(chaiSubset)

describe("e2e: Digest, Sign, Merge, Verify", () => {
    // NOTE: The signing certificate used by the cs is valid
    //       from 2022-11-25T12:29:00Z to 2023-11-25T12:29:00Z
    let csClient: Cs.CsClient
    let appImpl: Server.Impl
    before("Init", async () => {
        const dssClient = await makeDssClient()
        appImpl = new Server.Impl(dssClient)
        csClient = await makeCsClient()
    })

    for (const pdfpath of ["./assets/unsigned.pdf", "./assets/Test5.pdf", "./assets/Test6.pdf", "./assets/Test7.pdf"]) {
        test(`Happy path for ${pdfpath}`, async () => {
            const timestampUnixms = Number(new Date("2022-11-25T12:30:00Z"))
            const pdfBase64 = fs.readFileSync(pdfpath).toString("base64")
            const digestPdfRequest: Server.IDigestPdfRequest = {
                bytes: pdfBase64,
                digestAlgorithm: Server.EDigestAlgorithm.SHA256,
                signingTimestamp: timestampUnixms
            }
            const digestPdfRes = await appImpl.digestPdf(digestPdfRequest)
            expect(digestPdfRes.isErr()).to.be.false
            const digest = digestPdfRes._unsafeUnwrap().bytes

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

            const mergePdfRequest: Server.IMergePdfRequest = {
                bytes: pdfBase64,
                signatureAsCMS: cms,
                signingTimestamp: timestampUnixms
            }
            const mergePdfRes = await appImpl.mergePdf(mergePdfRequest)
            expect(mergePdfRes.isErr()).to.be.false
            const signedPdfBase64 = mergePdfRes._unsafeUnwrap()

            const validateSignedPdfRequest: Server.IValidateSignedPdfRequest = {
                bytes: signedPdfBase64.bytes
            }
            const validationResult = await appImpl.validateSignedPdf(validateSignedPdfRequest)
            expect(validationResult.isErr()).to.be.false
            const have = validationResult._unsafeUnwrap()
            // COMBAK: Adjust result and reason once the cs root certificate's metadata is complete.
            //         See #27
            const want: Partial<Server.IValidateSignedPdfResponse> = {
                valid: false
            }
            expect(have).to.containSubset(want)
        })
    }

    // test("Merging a signature based on an expired certificate doesn't work", async () => {
    //     const timestampUnixms = Number(new Date("2028-01-01T12:30:00Z"))
    //     const pdfBase64 = fs.readFileSync("./assets/unsigned.pdf").toString("base64")
    //     const digestPdfRequest: IDigestPDFRequest = {
    //         bytes: pdfBase64,
    //         digestAlgorithm: Dss.EDigestAlgorithm.SHA256,
    //         signingTimestamp: timestampUnixms
    //     }
    //     const digestPdfRes = await new service.DigestFacade(dssClient).digestPDF(digestPdfRequest)
    //     expect(digestPdfRes.isErr()).to.be.false
    //     const digest = digestPdfRes._unsafeUnwrap().digest

    //     const exampleSignatureRequest: Cs.ISignatureRequest = {
    //         auditLog: "Signing of Test Document",
    //         issuerId: "ID-OF-YOUR-KEY",
    //         hash: digest,
    //         digestMethod: "SHA256"
    //     }
    //     const getSignedCmsRes = await csClient.getSignedCms(exampleSignatureRequest)
    //     expect(getSignedCmsRes.isErr()).to.be.false
    //     const signedCms = getSignedCmsRes._unsafeUnwrap()
    //     const cms = signedCms.cms

    //     const mergePdfRequest: IMergePDFRequest = {
    //         bytes: pdfBase64,
    //         signatureAsCMS: cms,
    //         signingTimestamp: timestampUnixms
    //     }
    //     const mergePdfRes = await new service.MergeFacade(dssClient).mergePDF(mergePdfRequest)
    //     expect(mergePdfRes.isErr()).to.be.true
    //     expect(mergePdfRes._unsafeUnwrapErr()).to.be.instanceOf(Dss.Errors.CertificateExpired)
    // })

    // test("Merging a signature based on a not-yet-valid certificate doesn't work", async () => {
    //     const timestampUnixms = Number(new Date("2021-01-01T12:30:00Z"))
    //     const pdfBase64 = fs.readFileSync("./assets/unsigned.pdf").toString("base64")
    //     const digestPdfRequest: IDigestPDFRequest = {
    //         bytes: pdfBase64,
    //         digestAlgorithm: Dss.EDigestAlgorithm.SHA256,
    //         signingTimestamp: timestampUnixms
    //     }
    //     const digestPdfRes = await new service.DigestFacade(dssClient).digestPDF(digestPdfRequest)
    //     expect(digestPdfRes.isErr()).to.be.false
    //     const digest = digestPdfRes._unsafeUnwrap().digest

    //     const exampleSignatureRequest: Cs.ISignatureRequest = {
    //         auditLog: "Signing of TestDocument",
    //         issuerId: "ID-OF-YOUR-KEY",
    //         hash: digest,
    //         digestMethod: "SHA256"
    //     }
    //     const getSignedCmsRes = await csClient.getSignedCms(exampleSignatureRequest)
    //     expect(getSignedCmsRes.isErr()).to.be.false
    //     const signedCms = getSignedCmsRes._unsafeUnwrap()
    //     const cms = signedCms.cms

    //     const mergePdfRequest: IMergePDFRequest = {
    //         bytes: pdfBase64,
    //         signatureAsCMS: cms,
    //         signingTimestamp: timestampUnixms
    //     }
    //     const mergePdfRes = await new service.MergeFacade(dssClient).mergePDF(mergePdfRequest)
    //     expect(mergePdfRes.isErr()).to.be.true
    //     expect(mergePdfRes._unsafeUnwrapErr()).to.be.instanceOf(Dss.Errors.CertificateNotYetValid)
    // })
})

describe("Digest, Sign, Merge, Verify via HTTP APIs", () => {
    // /* eslint-disable */
    // // NOTE: The signing certificate used by the cs is valid
    // //       from 2022-11-25T12:29:00Z to 2023-11-25T12:29:00Z
    // let lmBaseUrl: string
    // let csClient: CsClient
    // before("Init", async () => {
    //     lmBaseUrl = await findLm()
    //     csClient = await makeCsClient()
    // })

    // for (const pdfpath of ["./assets/unsigned.pdf", "./assets/Test5.pdf", "./assets/Test6.pdf", "./assets/Test7.pdf"]) {
    //     const timestampMs = Number(new Date("2022-11-26T12:00:00Z"))
    //     test(`Happy path for ${pdfpath}`, async () => {
    //         const pdfBase64 = fs.readFileSync(pdfpath).toString("base64")
    //         const resDigest = await httpReq({
    //             method: "POST",
    //             baseURL: lmBaseUrl,
    //             url: "/digest/pdf",
    //             data: {
    //                 digestAlgorithm: "SHA256",
    //                 bytes: pdfBase64,
    //                 signingTimestamp: timestampMs
    //             }
    //         })
    //         expect(resDigest.isErr()).to.be.false
    //         const digest = resDigest._unsafeUnwrap().data.digest

    //         const resSign = await httpReq({
    //             method: "POST",
    //             baseURL: csClient.baseUrl,
    //             url: "/api/v1/signer/issuances",
    //             data: {
    //                 auditLog: "Signing of TestDocument",
    //                 issuerId: "ID-OF-YOUR-KEY",
    //                 hash: digest,
    //                 digestMethod: "SHA256"
    //             }
    //         })
    //         expect(resSign.isErr()).to.be.false
    //         const cms = resSign._unsafeUnwrap().data.cms

    //         const resMerge = await httpReq({
    //             method: "POST",
    //             baseURL: lmBaseUrl,
    //             url: "/merge/pdf",
    //             data: {
    //                 bytes: pdfBase64,
    //                 signatureAsCMS: cms,
    //                 signingTimestamp: timestampMs
    //             }
    //         })
    //         expect(resMerge.isErr()).to.be.false
    //         const signedPdf = resMerge._unsafeUnwrap().data.bytes

    //         const resValidate = await httpReq({
    //             method: "POST",
    //             baseURL: lmBaseUrl,
    //             url: "/validate/pdf",
    //             data: {
    //                 bytes: signedPdf
    //             }
    //         })
    //         expect(resValidate.isErr()).to.be.false
    //         const validationResult = resValidate._unsafeUnwrap().data
    //         expect(validationResult).to.deep.equal({
    //             result: Dss.ESignatureValidationIndication.INDETERMINATE,
    //             reason: Dss.ESignatureValidationSubIndication.TRY_LATER
    //         })
    //     })
    // }
    /* eslint-enable */
})

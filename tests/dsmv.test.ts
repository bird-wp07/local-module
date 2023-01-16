import { expect } from "chai"
import { describe, test } from "mocha"
import * as fs from "fs"
import * as Cs from "../src/cs"
import * as Dss from "../src/dss"
import * as service from "../src/server/controllers"
import { IDigestPDFRequest, IMergePDFRequest, IValidateSignedPdfRequest, IValidateSignedPdfResponse } from "../src/server/controllers/types"
import { makeCsClient, makeDssClient } from "./testsHelper"

describe("Digest, Sign, Merge, Verify", () => {
    // NOTE: The signing certificate used by the cs is valid
    //       from 2022-11-25T12:29:00Z to 2023-11-25T12:29:00Z
    let dssClient: Dss.DssClient
    let csClient: Cs.CsClient
    before("Init", async () => {
        dssClient = await makeDssClient()
        csClient = await makeCsClient()
    })

    test("Happy path", async () => {
        const timestampUnixms = Number(new Date("2022-11-25T12:30:00Z"))
        const pdfBase64 = fs.readFileSync("./assets/unsigned.pdf").toString("base64")
        const digestPdfRequest: IDigestPDFRequest = {
            bytes: pdfBase64,
            digestAlgorithm: Dss.EDigestAlgorithm.SHA256,
            signingTimestamp: timestampUnixms
        }
        const digestPdfRes = await new service.DigestFacade(dssClient).digestPDF(digestPdfRequest)
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

        const mergePdfRequest: IMergePDFRequest = {
            bytes: pdfBase64,
            signatureAsCMS: cms,
            signingTimestamp: timestampUnixms
        }
        const mergePdfRes = await new service.MergeFacade(dssClient).mergePDF(mergePdfRequest)
        expect(mergePdfRes.isErr()).to.be.false
        const signedPdfBase64 = mergePdfRes._unsafeUnwrap()

        const validateSignatureRequest: IValidateSignedPdfRequest = {
            bytes: signedPdfBase64.bytes
        }
        // COMBAK: Add authorization check to validation eventually.
        const validationResult = await new service.ValidateFacade(dssClient).validateSignature(validateSignatureRequest)
        expect(validationResult.isErr()).to.be.false
        const have = validationResult._unsafeUnwrap()
        // COMBAK: Adjust result and reason once the cs root certificate's metadata is complete.
        //         See #27
        const want: IValidateSignedPdfResponse = {
            result: Dss.ESignatureValidationIndication.INDETERMINATE,
            reason: Dss.ESignatureValidationSubIndication.TRY_LATER
        }
        expect(have).to.deep.equal(want)
    })

    test("Merging a signature based on an expired certificate doesn't work", async () => {
        const timestampUnixms = Number(new Date("2028-01-01T12:30:00Z"))
        const pdfBase64 = fs.readFileSync("./assets/unsigned.pdf").toString("base64")
        const digestPdfRequest: IDigestPDFRequest = {
            bytes: pdfBase64,
            digestAlgorithm: Dss.EDigestAlgorithm.SHA256,
            signingTimestamp: timestampUnixms
        }
        const digestPdfRes = await new service.DigestFacade(dssClient).digestPDF(digestPdfRequest)
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

        const mergePdfRequest: IMergePDFRequest = {
            bytes: pdfBase64,
            signatureAsCMS: cms,
            signingTimestamp: timestampUnixms
        }
        const mergePdfRes = await new service.MergeFacade(dssClient).mergePDF(mergePdfRequest)
        expect(mergePdfRes.isErr()).to.be.true
        expect(mergePdfRes._unsafeUnwrapErr()).to.be.instanceOf(Dss.Errors.CertificateExpired)
    })

    test("Merging a signature based on a not-yet-valid certificate doesn't work", async () => {
        const timestampUnixms = Number(new Date("2021-01-01T12:30:00Z"))
        const pdfBase64 = fs.readFileSync("./assets/unsigned.pdf").toString("base64")
        const digestPdfRequest: IDigestPDFRequest = {
            bytes: pdfBase64,
            digestAlgorithm: Dss.EDigestAlgorithm.SHA256,
            signingTimestamp: timestampUnixms
        }
        const digestPdfRes = await new service.DigestFacade(dssClient).digestPDF(digestPdfRequest)
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

        const mergePdfRequest: IMergePDFRequest = {
            bytes: pdfBase64,
            signatureAsCMS: cms,
            signingTimestamp: timestampUnixms
        }
        const mergePdfRes = await new service.MergeFacade(dssClient).mergePDF(mergePdfRequest)
        expect(mergePdfRes.isErr()).to.be.true
        expect(mergePdfRes._unsafeUnwrapErr()).to.be.instanceOf(Dss.Errors.CertificateNotYetValid)
    })
})

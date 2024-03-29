import chai, { expect } from "chai"
import chaiSubset from "chai-subset"
import { describe, test } from "mocha"
import * as fs from "fs"
import * as Applogic from "../src/applogic"
import * as Utility from "../src/utility"
import { makeCsClient, makeDssClient } from "./testsHelper"
import { Base64 } from "../src/utility"

chai.use(chaiSubset)

describe("Application logic layer", () => {
    const csIssuerId = (Utility.parseKeyValueFile(".env")._unsafeUnwrap() as any).WP07_CS_ISSUER_ID as string
    let appImpl: Applogic.IAppLogic
    before("Init", async () => {
        const dssClient = await makeDssClient()
        const csClient = await makeCsClient()
        appImpl = new Applogic.AppLogic(dssClient, csClient)
    })

    test("Happy path: Digest, sign, merge, verify, revoke", async () => {
        /* NOTE: These tests assume that the development issuer id will be used,
         *       which will produce signatures using a self-signed certificate,
         *       instead of a trusted certificate. Thus all validations are
         *       expected to return a negative result.
         *
         *       The self-signed signing certificate is valid from
         *       2022-11-25T12:29:00Z to 2023-11-25T12:29:00Z */
        const pdfpath = "./tests/files/unsigned.pdf"
        const timestamp = new Date("2022-11-25T12:30:00Z")
        const pdf: Base64 = fs.readFileSync(pdfpath).toString("base64")

        /* Digest */
        const rsltGenerateDbts = await appImpl.generatePdfDigestToBeSigned(pdf, timestamp)
        expect(rsltGenerateDbts.isErr()).to.be.false
        const dataToBeSigned: Base64 = rsltGenerateDbts._unsafeUnwrap()

        /* Issue */
        const rsltIssueSignature = await appImpl.issueSignature(dataToBeSigned, csIssuerId)
        expect(rsltIssueSignature.isErr()).to.be.false
        const cms: Base64 = rsltIssueSignature._unsafeUnwrap().cms
        const signatureValueDigest: Base64 = rsltIssueSignature._unsafeUnwrap().signatureValueDigest

        /* Merge */
        const rsltEmbedSignature = await appImpl.embedSignatureIntoPdf(pdf, timestamp, cms)
        expect(rsltEmbedSignature.isErr()).to.be.false
        const signedPdf: Base64 = rsltEmbedSignature._unsafeUnwrap()

        /* Validate */
        const rsltValidate = await appImpl.validateSignedPdf(signedPdf)
        expect(rsltValidate.isErr()).to.be.false
        const validationResult = rsltValidate._unsafeUnwrap()
        expect(validationResult.valid).to.be.false
        expect(validationResult.document.status).to.be.equal(Applogic.EDocumentValidity.ERROR_DOCUMENT_UNTRUSTED)
        expect(validationResult.issuance.status).to.be.equal(Applogic.EIssuanceValidity.ISSUANCE_OK)

        /* Revoke */
        const rsltRevoke = await appImpl.revokeSignature(signatureValueDigest, Applogic.ERevocationReason.FORMAL_MISTAKE)
        expect(rsltRevoke.isErr()).to.be.false
        const revocationResult = rsltRevoke._unsafeUnwrap()
        expect(revocationResult.status).to.be.equal(Applogic.ERevocationStatus.ISSUANCE_REVOKED)

        /* Validate post revocation */
        const rsltValidate2 = await appImpl.validateSignedPdf(signedPdf)
        expect(rsltValidate2.isErr()).to.be.false
        const validationResult2 = rsltValidate2._unsafeUnwrap()
        expect(validationResult2.valid).to.be.false // COMBACK: Change once we have a trusted certificate
        expect(validationResult2.issuance.status).to.be.equal(Applogic.EIssuanceValidity.ERROR_ISSUANCE_REVOKED)

        /* Revoke again */
        const rsltRevoke2 = await appImpl.revokeSignature(signatureValueDigest, Applogic.ERevocationReason.SECURITY_ISSUE)
        expect(rsltRevoke2.isErr()).to.be.false
        const revocationResult2 = rsltRevoke2._unsafeUnwrap()
        expect(revocationResult2.status).to.be.equal(Applogic.ERevocationStatus.ISSUANCE_REVOKED)
    })

    test("Catch manipulated PDFs", async () => {
        {
            /* Checks whether signed PDFs, which have been changed via incremental
             * updates will be flagged as invalid. */
            const signedPdf = fs.readFileSync("./tests/files/signed-trusted-manipulated-incremental.pdf", "base64")
            const rsltValidate = await appImpl.validateSignedPdf(signedPdf)
            expect(rsltValidate.isErr()).to.be.false
            const validationResult = rsltValidate._unsafeUnwrap()
            expect(validationResult.valid).to.be.false
            expect(validationResult.document.status).to.be.equal(Applogic.EDocumentValidity.ERROR_DOCUMENT_INVALID)
        }
        {
            /* Checks whether PDFs, which have been tampered with within the
             * byte range covered by the signature, are flagged as invalid. */
            const signedPdf = fs.readFileSync("./tests/files/signed-trusted-manipulated.pdf", "base64")
            const rsltValidate = await appImpl.validateSignedPdf(signedPdf)
            expect(rsltValidate.isErr()).to.be.false
            const validationResult = rsltValidate._unsafeUnwrap()
            expect(validationResult.valid).to.be.false

            /* TODO: Manipulations inside and outside of the signature's byte range produduce different return statuses.
             *       This is a consequence of the current, lazy implementation
             *       of the DSS validation, which just checks whether we get a
             *       TOTAL_PASSED result. It would be better, if *_UNTRUSTED
             *       referred to problems with the signature and if
             *       tempering with signed documents produced a
             *       DOCUMENT_INVALID error. */
            expect(validationResult.document.status).to.be.equal(Applogic.EDocumentValidity.ERROR_DOCUMENT_UNTRUSTED)
        }
    })

    test.skip("Attach files to PDFs", async () => {
        // FIXME: pdf-lib attachment embedding is broken
        const xmlInput = "<xml>hello wörld</xml>"
        const xmlAttachmentBytes = Buffer.from(xmlInput)
        const pdfAttachmentBytes = fs.readFileSync("./tests/files/unsigned.pdf")

        const pdf: Base64 = fs.readFileSync("./tests/files/unsigned.pdf").toString("base64")
        const inputAttachments = [
            {
                filename: "myself.pdf",
                bytes: pdfAttachmentBytes.toString("base64")
            },
            {
                filename: "helloworld.xml",
                bytes: xmlAttachmentBytes.toString("base64")
            }
        ]
        const rsltAttachFiles = await appImpl.attachFiles(pdf, inputAttachments)
        expect(rsltAttachFiles.isErr()).to.be.false
        const pdfWithAttachments = rsltAttachFiles._unsafeUnwrap()

        const rsltExtractAttachments = await appImpl.extractAttachments(pdfWithAttachments)
        expect(rsltExtractAttachments.isErr()).to.be.false
        const attachments = rsltExtractAttachments._unsafeUnwrap()
        expect(attachments).to.have.members(inputAttachments)
    })

    test("Extract attachments", async () => {
        const table = [
            {
                /* PDF with two attachments. */
                filepath: "./tests/files/2-attachments.pdf",
                attachmentFilenames: ["cars.csv", "mini.jpg"]
            },
            {
                /* PDF with one attachment. */
                filepath: "./tests/files/1-attachment.pdf",
                attachmentFilenames: ["books.xml"]
            },
            {
                /* PDF without attachments. */
                filepath: "./tests/files/unsigned.pdf",
                attachmentFilenames: []
            },
            {
                /* Bogus input. */
                filepath: "package.json",
                attachmentFilenames: []
            }
        ]

        for (const input of table) {
            const pdf = fs.readFileSync(input.filepath).toString("base64")
            const rsltExtractAttachments = await appImpl.extractAttachments(pdf)
            const attachments = rsltExtractAttachments._unsafeUnwrap()
            const filenames = attachments.map((a) => {
                return a.filename
            })
            expect(filenames).to.have.members(input.attachmentFilenames)
        }
    })
})

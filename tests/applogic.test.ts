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
    const pdfpath = "./tests/files/unsigned.pdf"
    let appImpl: Applogic.IAppLogic
    before("Init", async () => {
        const dssClient = await makeDssClient()
        const csClient = await makeCsClient()
        appImpl = new Applogic.AppLogic(dssClient, csClient)
    })

    test("Happy path: Digest, sign, merge, verify, revoke", async () => {
        // NOTE: The signing certificate used by the cs is valid
        //       from 2022-11-25T12:29:00Z to 2023-11-25T12:29:00Z
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
        expect(validationResult.valid).to.be.false // COMBACK: Change once we have a trusted certificate
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

        // FIXME: This should return an error indicating that the issuance has already been invoked.
        expect(revocationResult2.status).to.be.equal(Applogic.ERevocationStatus.ISSUANCE_REVOKED)
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

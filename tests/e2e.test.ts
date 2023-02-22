import chai, { expect } from "chai"
import chaiSubset from "chai-subset"
import { describe, test } from "mocha"
import * as fs from "fs"
import * as Applogic from "../src/applogic"
import * as Utility from "../src/utility"
import { makeCsClient, makeDssClient } from "./testsHelper"
import { Base64 } from "../src/utility"

chai.use(chaiSubset)

describe("End-to-end tests", () => {
    const csIssuerId = (Utility.parseKeyValueFile(".env")._unsafeUnwrap() as any).WP07_CS_ISSUER_ID as string
    let appImpl: Applogic.IAppLogic
    before("Init", async () => {
        const dssClient = await makeDssClient()
        const csClient = await makeCsClient()
        appImpl = new Applogic.AppLogic(dssClient, csClient)
    })

    describe("Digest, sign, merge and verify of a PDF", () => {
        const pdfpath = "./tests/files/unsigned.pdf"
        test(`Happy path for ${pdfpath}`, async () => {
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
            const cms: Base64 = rsltIssueSignature._unsafeUnwrap()

            /* Merge */
            const rsltEmbedSignature = await appImpl.embedSignatureIntoPdf(pdf, timestamp, cms)
            expect(rsltEmbedSignature.isErr()).to.be.false
            const signedPdf: Base64 = rsltEmbedSignature._unsafeUnwrap()

            /* Verify */
            const rsltValidate = await appImpl.validateSignedPdf(signedPdf)
            expect(rsltValidate.isErr()).to.be.false
            const validationResult = rsltValidate._unsafeUnwrap()
            expect(validationResult.valid).to.be.false // COMBACK: Change once we have a trusted certificate
        })
    })
})

import chai, { expect } from "chai"
import chaiSubset from "chai-subset"
import { describe, test } from "mocha"
import * as fs from "fs"
import * as Applogic from "../src/applogic"
import { makeCsClient, makeDssClient } from "./testsHelper"
import { Base64 } from "../src/utility"

chai.use(chaiSubset)

describe("End-to-end tests", () => {
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
            const resultDigest = await appImpl.generateDataToBeSigned(pdf, timestamp)
            expect(resultDigest.isErr()).to.be.false
            const dataToBeSigned: Base64 = resultDigest._unsafeUnwrap()

            /* Sign */
            const resultSign = await appImpl.generateSignature(dataToBeSigned)
            expect(resultSign.isErr()).to.be.false
            const cms: Base64 = resultSign._unsafeUnwrap()

            /* Merge */
            const resultMerge = await appImpl.embedSignatureIntoPdf(pdf, timestamp, cms)
            expect(resultMerge.isErr()).to.be.false
            const signedPdf: Base64 = resultMerge._unsafeUnwrap()

            /* Verify */
            const resultVerify = await appImpl.validateSignedPdf(signedPdf)
            expect(resultVerify.isErr()).to.be.false
            const validationResult = resultVerify._unsafeUnwrap()
            expect(validationResult.valid).to.be.false // COMBACK: Change once we have a trusted certificate
        })
    })
})

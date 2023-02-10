import chai, { expect } from "chai"
import chaiSubset from "chai-subset"
import { describe, test } from "mocha"
import * as fs from "fs"
import * as Cs from "../src/cs"
import * as Server from "../src/server"
import { makeCsClient, makeDssClient } from "./testsHelper"

chai.use(chaiSubset)

describe("End-to-end", () => {
    // NOTE: The signing certificate used by the cs is valid
    //       from 2022-11-25T12:29:00Z to 2023-11-25T12:29:00Z
    let csClient: Cs.CsClient
    let appImpl: Server.Impl
    before("Init", async () => {
        const dssClient = await makeDssClient()
        appImpl = new Server.Impl(dssClient)
        csClient = await makeCsClient()
    })

    describe("Digest, sign, merge and verify of a PDF", () => {
        const pdfpath = "./tests/files/unsigned.pdf"
        test(`Happy path for ${pdfpath}`, async () => {
            const timestampUnixms = Number(new Date("2022-11-25T12:30:00Z"))
            const pdfBase64 = fs.readFileSync(pdfpath).toString("base64")
            const digestPdfRequest: Server.IDigestPdfRequest = {
                bytes: pdfBase64,
                timestamp: timestampUnixms
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
            const want: Partial<Server.IValidateSignedPdfResponse> = {
                valid: false
            }
            expect(have).to.containSubset(want)
        })
    })
})

import { describe, test } from "mocha"
import { expect } from "chai"
import { Base64 } from "../src/utility"
import * as Cs from "../src/cs"
import * as Utility from "../src/utility"
import { makeCsClient } from "./testsHelper"

describe("Central Service", () => {
    const csIssuerId = (Utility.parseKeyValueFile(".env")._unsafeUnwrap() as any).WP07_CS_ISSUER_ID as string
    describe("API Sanity Checks via CsClient", () => {
        let csClient: Cs.CsClient
        before("Init", async () => {
            csClient = await makeCsClient()
        })

        test("fetchToken()", async () => {
            const resFetchAuthToken = await csClient.fetchAuthToken()
            expect(resFetchAuthToken.isErr()).to.be.false
        })

        test("issueSignature(), validateIssuance(),", async () => {
            const digestToBeSigned = "qGGJNxM84aPD3Cj5zX4ef7Pe5NV8zHCMchoZUkZfXX8="
            const digestMethod = Cs.EDigestAlgorithm.SHA256
            const issuerId = csIssuerId
            const rsltIssueSignature = await csClient.issueSignature(digestToBeSigned, digestMethod, issuerId)
            expect(rsltIssueSignature.isErr()).to.be.false
            const cms: Base64 = rsltIssueSignature._unsafeUnwrap().cms

            const rsltExtractSignature = Utility.extractSignatureValueFromCms(Buffer.from(cms, "base64"))
            expect(rsltExtractSignature.isErr()).to.be.false
            const signatureValue: Buffer = rsltExtractSignature._unsafeUnwrap()
            const signatureValueDigest: Base64 = Utility.sha256sum(signatureValue).toString("base64")

            const rsltValidateIssuance = await csClient.validateIssuance(signatureValueDigest)
            expect(rsltValidateIssuance.isErr()).to.be.false
            const verifySignatureResult = rsltValidateIssuance._unsafeUnwrap()
            expect(verifySignatureResult.valid).to.be.true
        })

        test.skip("CsClient#revokeSignature")
    })
})

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

        test("issueSignature(), verifySignature(),", async () => {
            const request: Cs.IIssueSignatureRequest = {
                hash: "qGGJNxM84aPD3Cj5zX4ef7Pe5NV8zHCMchoZUkZfXX8=",
                digestMethod: Cs.EDigestAlgorithm.SHA256,
                issuerId: csIssuerId
            }
            const resIssueSignature = await csClient.issueSignature(request)
            expect(resIssueSignature.isErr()).to.be.false
            const cms: Base64 = resIssueSignature._unsafeUnwrap().cms

            const resExtract = Utility.extractSignatureValueFromCms(Buffer.from(cms, "base64"))
            expect(resExtract.isErr()).to.be.false
            const signature: Buffer = resExtract._unsafeUnwrap()

            const resVerifySignature = await csClient.verifySignature({ digest: signature.toString("base64") })
            expect(resVerifySignature.isErr()).to.be.false
            const verifySignatureResult = resVerifySignature._unsafeUnwrap()

            // TODO: should be true; fix once CS validation API is adjusted
            expect(verifySignatureResult.valid).to.be.false
        })

        test.skip("CsClient#verifySignature")
        test.skip("CsClient#revokeSignature")
    })
})

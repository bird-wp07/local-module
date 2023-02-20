import { describe, test } from "mocha"
import { expect } from "chai"
import * as Cs from "../src/cs"
import * as Utility from "../src/utility"
import { makeCsClient } from "./testsHelper"

describe("Central Service", () => {
    const csIssuerId = (Utility.parseKeyValueFile(".env") as any).WP07_CS_ISSUER_ID as string
    describe("API Sanity Checks", () => {
        let csClient: Cs.CsClient
        before("Init", async () => {
            csClient = await makeCsClient()
        })

        test("CsClient#fetchToken()", async () => {
            const tokenResponse = await csClient.fetchAuthToken()
            expect(tokenResponse.isErr()).to.be.false
        })

        test("CsClient#generateSignature(), #isValid", async () => {
            const request: Cs.IIssueSignatureRequest = {
                hash: "qGGJNxM84aPD3Cj5zX4ef7Pe5NV8zHCMchoZUkZfXX8=",
                digestMethod: Cs.EDigestAlgorithm.SHA256,
                issuerId: csIssuerId
            }
            const generateSignatureResponse = await csClient.issueSignature(request)
            expect(generateSignatureResponse.isErr()).to.be.false
        })

        test.skip("CsClient#verifySignature")
        test.skip("CsClient#revokeSignature")
    })
})

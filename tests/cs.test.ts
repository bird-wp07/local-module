import { describe, test } from "mocha"
import { expect } from "chai"
import * as Cs from "../src/cs"
import * as Dss from "../src/dss"
import { makeCsClient } from "./testsHelper"

describe("Central Service", () => {
    describe("API Sanity Checks", () => {
        let csClient: Cs.CsClient
        before("Init", async () => {
            csClient = await makeCsClient()
        })

        test("CsClient#fetchToken()", async () => {
            const tokenResponse = await csClient.fetchAuthToken()
            expect(tokenResponse.isErr()).to.be.false
        })

        test("CsClient#fetchSignature(), #isValid", async () => {
            const request: Cs.IFetchSignatureRequest = {
                hash: "qGGJNxM84aPD3Cj5zX4ef7Pe5NV8zHCMchoZUkZfXX8=",
                digestMethod: Cs.EDigestAlgorithm.SHA256
            }
            const fetchSignatureResponse = await csClient.fetchSignature(request)
            expect(fetchSignatureResponse.isErr()).to.be.false

            // TODO: Implement once signature checking and revocation routes are implemented
            // const cms = Buffer.from(fetchSignatureResponse._unsafeUnwrap().cms, "base64")
            // const { signatureValue } = Dss.Utils.parseCms(cms)
        })
    })
})

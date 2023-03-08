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
            const rsltFetchAuthToken = await csClient.fetchAuthToken()
            expect(rsltFetchAuthToken.isErr()).to.be.false
        })

        test("issueSignature(), validateIssuance(), revokeIssuance(),", async () => {
            /* Issue a signature */
            const digestToBeSigned = "qGGJNxM84aPD3Cj5zX4ef7Pe5NV8zHCMchoZUkZfXX8="
            const digestMethod = Cs.EDigestAlgorithm.SHA256
            const rsltIssueSignature = await csClient.issueSignature(digestToBeSigned, digestMethod, csIssuerId)
            expect(rsltIssueSignature.isErr()).to.be.false
            const signatureValueDigest: Base64 = rsltIssueSignature._unsafeUnwrap().hashes[0].hash

            /* Validate issuance */
            const rsltValidateIssuance = await csClient.validateIssuance(signatureValueDigest)
            expect(rsltValidateIssuance.isErr()).to.be.false
            const verifySignatureResult = rsltValidateIssuance._unsafeUnwrap()
            expect(verifySignatureResult.valid).to.be.true

            /* Revoke issuance */
            const rsltRevokeIssuance = await csClient.revokeIssuance(signatureValueDigest, "Gutenberg")
            expect(rsltRevokeIssuance.isErr()).to.be.false
            const revokeIssuanceResult = rsltRevokeIssuance._unsafeUnwrap()
            expect(revokeIssuanceResult.status).to.be.equal(Cs.EIssuanceRevocationStatus.ISSUANCE_REVOKED)

            /* Revoke revoked issuance */
            const rsltRevokeIssuance2 = await csClient.revokeIssuance(signatureValueDigest, "Gutenberg")
            expect(rsltRevokeIssuance2.isErr()).to.be.false
            const revokeIssuanceResult2 = rsltRevokeIssuance2._unsafeUnwrap()
            // FIXME: w/f Felix, 409 anstatt 201 erwartet
            expect(revokeIssuanceResult2.status).to.be.equal(Cs.EIssuanceRevocationStatus.ISSUANCE_REVOKED)

            /* Revoke unknown issuance */
            const signatureValueDigestNew: Base64 = Utility.sha256sum(Buffer.from(String(new Date()))).toString("base64")
            const rsltRevokeIssuanceNew = await csClient.revokeIssuance(signatureValueDigestNew, "Gutenberg")
            expect(rsltRevokeIssuanceNew.isErr()).to.be.false
            const revokeIssuanceResultNew = rsltRevokeIssuanceNew._unsafeUnwrap()
            expect(revokeIssuanceResultNew.status).to.be.equal(Cs.EIssuanceRevocationStatus.ISSUANCE_NOT_FOUND)
        })
    })
})

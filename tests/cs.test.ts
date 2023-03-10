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
            const issuanceNotRevoked = verifySignatureResult.results.find((r) => r.policyId === Cs.EIssuanceValidationPolicy.ISSUANCE_NOT_REVOKED)!.passed
            const issuanceExists = verifySignatureResult.results.find((r) => r.policyId === Cs.EIssuanceValidationPolicy.ISSUANCE_EXISTS)!.passed
            const issuerNotRevoked = verifySignatureResult.results.find((r) => r.policyId === Cs.EIssuanceValidationPolicy.ISSUER_NOT_REVOKED)!.passed
            expect(issuanceNotRevoked).to.be.true
            expect(issuanceExists).to.be.true
            expect(issuerNotRevoked).to.be.true

            /* Revoke issuance */
            const rsltRevokeIssuance = await csClient.revokeIssuance(signatureValueDigest, Cs.ERevocationReason.UNSPECIFIED)
            expect(rsltRevokeIssuance.isErr()).to.be.false
            const revokeIssuanceResult = rsltRevokeIssuance._unsafeUnwrap()
            expect(revokeIssuanceResult.status).to.be.equal(Cs.EIssuanceRevocationStatus.ISSUANCE_REVOKED)

            /* Validate issuance post revocation */
            const rsltValidateIssuance2 = await csClient.validateIssuance(signatureValueDigest)
            expect(rsltValidateIssuance2.isErr()).to.be.false
            const verifySignatureResult2 = rsltValidateIssuance2._unsafeUnwrap()
            expect(verifySignatureResult2.valid).to.be.false
            const issuanceNotRevoked2 = verifySignatureResult2.results.find((r) => r.policyId === Cs.EIssuanceValidationPolicy.ISSUANCE_NOT_REVOKED)!.passed
            const issuanceExists2 = verifySignatureResult2.results.find((r) => r.policyId === Cs.EIssuanceValidationPolicy.ISSUANCE_EXISTS)!.passed
            const issuerNotRevoked2 = verifySignatureResult2.results.find((r) => r.policyId === Cs.EIssuanceValidationPolicy.ISSUER_NOT_REVOKED)!.passed
            expect(issuanceNotRevoked2).to.be.false
            expect(issuanceExists2).to.be.true
            expect(issuerNotRevoked2).to.be.true

            /* Revoke revoked issuance */
            const rsltRevokeIssuance2 = await csClient.revokeIssuance(signatureValueDigest, Cs.ERevocationReason.SECURITY_ISSUE)
            expect(rsltRevokeIssuance2.isErr()).to.be.false
            const revokeIssuanceResult2 = rsltRevokeIssuance2._unsafeUnwrap()
            expect(revokeIssuanceResult2.status).to.be.equal(Cs.EIssuanceRevocationStatus.ISSUANCE_REVOKED)
        })

        test("Validate and revoke unknown signature", async () => {
            const signatureValueDigest: Base64 = Utility.sha256sum(Buffer.from(String(new Date()))).toString("base64")

            /* Revoke */
            const rsltRevokeIssuance = await csClient.revokeIssuance(signatureValueDigest, Cs.ERevocationReason.FORMAL_MISTAKE)
            expect(rsltRevokeIssuance.isErr()).to.be.false
            const revokeIssuanceResult = rsltRevokeIssuance._unsafeUnwrap()
            expect(revokeIssuanceResult.status).to.be.equal(Cs.EIssuanceRevocationStatus.ISSUANCE_NOT_FOUND)

            /* Validate */
            const rsltValidateIssuance = await csClient.validateIssuance(signatureValueDigest)
            expect(rsltValidateIssuance.isErr()).to.be.false
            const verifySignatureResult = rsltValidateIssuance._unsafeUnwrap()
            expect(verifySignatureResult.valid).to.be.false
            const issuanceNotRevoked = verifySignatureResult.results.find((r) => r.policyId === Cs.EIssuanceValidationPolicy.ISSUANCE_NOT_REVOKED)!.passed
            const issuanceExists = verifySignatureResult.results.find((r) => r.policyId === Cs.EIssuanceValidationPolicy.ISSUANCE_EXISTS)!.passed
            const issuerNotRevoked = verifySignatureResult.results.find((r) => r.policyId === Cs.EIssuanceValidationPolicy.ISSUER_NOT_REVOKED)!.passed
            expect(issuanceExists).to.be.false
            expect(issuanceNotRevoked).to.be.null
            expect(issuerNotRevoked).to.be.null
        })
    })
})

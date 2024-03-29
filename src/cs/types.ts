import { Base64 } from "../utility"
import * as Joi from "joi"

export enum EDigestAlgorithm {
    SHA256 = "SHA256"
}

export interface IIssueSignatureRequest {
    /**
     * Base64 encoded digest to be signed, here referred to as 'hash' (of the
     * (augmented) PDF in question).
     */
    hash: Base64
    digestMethod: EDigestAlgorithm
    issuerId: string
    auditLog?: string
}

export interface IIssueSignatureResponse {
    /**
     * Signature in CMS format.
     */
    cms: Base64
    hashes: [
        {
            hashType: "SIGNATURE_HASH"

            /**
             * Base64 encoded SHA256 hash of signature value.
             */
            hash: Base64
        }
    ]
}

export const Schema_IIssueSignatureResponse = Joi.object().keys({
    cms: Joi.string().base64().required(),
    hashes: Joi.array().items(
        Joi.object().keys({
            hashType: Joi.valid("SIGNATURE_HASH").required(),
            hash: Joi.string().base64().required()
        })
    )
})

/* Signature / issuance validity checking */
/* -------------------------------------- */

export enum EIssuanceValidationPolicy {
    ISSUANCE_EXISTS = "IssuanceExists",
    ISSUANCE_NOT_REVOKED = "IssuanceNotRevoked",
    ISSUER_NOT_REVOKED = "IssuerNotRevoked"
}

export interface IValidateIssuanceResponse {
    /**
     * Overall result. True if and only if all policy checks are successful
     *
     * TODO: What's details doing?
     */
    valid: boolean
    results: [
        {
            policyId: EIssuanceValidationPolicy.ISSUANCE_EXISTS
            policyDescription: string
            passed: boolean
            details: null
        },
        {
            policyId: EIssuanceValidationPolicy.ISSUANCE_NOT_REVOKED
            policyDescription: string

            /* null iff issuance does not exist */
            passed: boolean | null

            details: null
        },
        {
            policyId: EIssuanceValidationPolicy.ISSUER_NOT_REVOKED
            policyDescription: string

            /* null iff issuance does not exist */
            passed: boolean | null

            details: null
        }
    ]
}

export const Schema_IValidateIssuanceResponse = Joi.object().keys({
    valid: Joi.boolean().required(),
    results: Joi.array().items(
        Joi.object({
            policyId: Joi.string().valid(...Object.values(EIssuanceValidationPolicy)),
            policyDescription: Joi.string().required(),
            passed: Joi.boolean().allow(null).required(),
            details: Joi.allow(null)
        }).required()
    )
})

/* Signature / issuance revocation */
/* ------------------------------- */

export enum ERevocationReason {
    SECURITY_ISSUE = "SECURITY_ISSUE",
    FORMAL_MISTAKE = "FORMAL_MISTAKE",
    UNSPECIFIED = "UNSPECIFIED"
}

export enum EIssuanceRevocationStatus {
    ISSUANCE_REVOKED = "ISSUANCE_REVOKED",
    ISSUANCE_NOT_FOUND = "ISSUANCE_NOT_FOUND"
}

export interface IRevokeIssuanceResponse {
    /**
     * Status code
     */
    status: EIssuanceRevocationStatus

    /**
     * Revocation date in case of revoked, or already revoked issuance.
     */
    revocationDate?: Date
}

/* Authentication */
/* -------------- */

export interface IFetchAuthTokenResponse {
    access_token: Base64
    expires_in: number
    refresh_expires_in: number
    refresh_token: Base64
    token_type: "Bearer"
    "not-before-policy": number
    session_state: string
    scope: "issueing"
}

export const Schema_IFetchAuthToken = Joi.object().keys({
    access_token: Joi.string().required(), // apparently base64-url encoded; same for refresh_token
    expires_in: Joi.number().required(),
    refresh_expires_in: Joi.number().required(),
    refresh_token: Joi.string().required(),
    token_type: Joi.valid("Bearer").required(),
    "not-before-policy": Joi.number().required(),
    session_state: Joi.string().required(),
    scope: Joi.valid("issueing").required()
})

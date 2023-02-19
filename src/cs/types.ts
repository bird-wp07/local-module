import { Base64 } from "../utility"
import * as Joi from "joi"

export enum EDigestAlgorithm {
    SHA256 = "SHA256"
}

export interface IFetchSignatureRequest {
    hash: Base64
    digestMethod: EDigestAlgorithm
    auditLog?: string
}

export interface IFetchSignatureResponse {
    cms: Base64
}

export const Schema_IFetchSignatureResponse = Joi.object().keys({
    cms: Joi.string().base64()
})

export interface IVerifySignatureRequest {
    digest: Base64
}

export interface IVerifySignatureResponse {
    valid: boolean
    results?: [
        {
            policyId: string
            policyDescription: string
            passed: boolean
        }
    ]
}

/**
 * Returned in case of success. Failure results in a 404.
 */
export const Schema_IVerifySignatureResponse = Joi.object().keys({
    valid: Joi.boolean().required(),
    results: Joi.array().items(
        Joi.object().keys({
            policyId: Joi.string().required(),
            policyDescription: Joi.string().required(),
            passed: Joi.boolean().required()
        })
    )
})

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
    access_token: Joi.string(), // apparently base64-url encoded; same for refresh_token
    expires_in: Joi.number(),
    refresh_expires_in: Joi.number(),
    refresh_token: Joi.string(),
    token_type: Joi.valid("Bearer"),
    "not-before-policy": Joi.number(),
    session_state: Joi.string(),
    scope: Joi.valid("issueing")
})

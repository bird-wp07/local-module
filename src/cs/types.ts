import { Base64 } from "../types"
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

/**
 * Interface definitions and their respective validation schemas. We restrict
 * the subset of allowed values to a minimum for simplicity's sake.
 */

import * as Applogic from "../applogic"
import { HTTP_MAX_REQUEST_BODY_SIZE_BYTES } from "./routes"

import { Base64, UnixTimeMs } from "../utility"
import * as Joi from "joi"

export enum EHealthStatus {
    OK = "OK",
    ERROR = "ERROR"
}
export interface IHealthResponse {
    status: EHealthStatus
    details?: any
}

export interface IDigestPdfRequest {
    /**
     * Base64 encoded PDF.
     */
    bytes: Base64

    /**
     * Timestamp in milliseconds since epoch.
     */
    signingTimestamp: UnixTimeMs
}

export const Schema_IDigestPdfRequest = Joi.object().keys({
    bytes: Joi.string().base64().required(),
    signingTimestamp: Joi.number().min(0).required()
})

export interface IDigestPdfResponse {
    /**
     * Base64 encoded SHA256 digest to be signed.
     */
    bytes: Base64
}

/**
 * Signature issue request.
 */
export interface IIssueRequest {
    /**
     * Base64 encoded SHA256 digest to be signed.
     */
    bytes: Base64
    issuerId: string
    auditLog?: string
}

export const Schema_IIssueRequest = Joi.object().keys({
    bytes: Joi.string().base64().required(),
    issuerId: Joi.string().required(),
    auditLog: Joi.string()
})

export interface IIssueResponse {
    /**
     * Base64 encoded signature in CMS format.
     */
    cms: Base64
}

export interface IMergePdfRequest {
    /**
     * Base64 encoded original PDF used to generate the digest to be signed
     */
    bytes: Base64

    /**
     * Original signing timestamp used to generate the digest to be signed
     */
    signingTimestamp: UnixTimeMs

    /**
     * Base64 encoded signature in CMS format
     */
    cms: Base64
}

export const Schema_IMergePdfRequest = Joi.object().keys({
    bytes: Joi.string().base64().required(),
    signingTimestamp: Joi.number().min(0).required(),
    cms: Joi.string().base64().required()
})

export interface IMergePdfResponse {
    /**
     * Base64 encoded signed PDF
     */
    bytes: Base64
}

export interface IValidateSignedPdfRequest {
    /**
     * Base64 encoded signed PDF
     */
    bytes: Base64
}

export const Schema_IValidateSignedPdfRequest = Joi.object().keys({
    bytes: Joi.string().base64().required()
})

export type IValidateSignedPdfResponse = Applogic.IValidationResult

export interface ISignPdfRequest {
    /**
     * Base64 encoded PDF
     */
    bytes: Base64

    /**
     * Issuer ID required to issue signatures
     */
    issuerId: string
}

export const Schema_ISignPdfRequest = Joi.object().keys({
    bytes: Joi.string().base64().required(),
    issuerId: Joi.string().required()
})

export interface ISignPdfResponse {
    /**
     * Base64 encoded signed PDF
     */
    bytes: Base64
}

/**
 * Errors returned by the HTTP API.
 */
export enum EErrorCode {
    REQUEST_VALIDATION_ERROR = "REQUEST_VALIDATION_ERROR",
    REQUEST_SIZE_TOO_LARGE = "REQUEST_SIZE_TOO_LARGE",
    REQUEST_PROCESSING_ERROR = "REQUEST_PROCESSING_ERROR",
    UNHANDLED_ERROR = "UNHANDLED_ERROR"
}

export class ErrorBase extends Error {
    errorCode: EErrorCode
    message: string
    details: any
    constructor(errorCode: EErrorCode, message: string, details: unknown) {
        super()
        this.errorCode = errorCode
        this.message = message
        this.details = details
    }
}

export class RequestValidationError extends ErrorBase {
    private static errorCode = EErrorCode.REQUEST_VALIDATION_ERROR
    constructor(details: any) {
        super(RequestValidationError.errorCode, "request validation failed", details)
    }
}

export class RequestBodyTooLarge extends ErrorBase {
    private static errorCode = EErrorCode.REQUEST_SIZE_TOO_LARGE
    constructor() {
        super(RequestBodyTooLarge.errorCode, `request body size must not exceed ${HTTP_MAX_REQUEST_BODY_SIZE_BYTES} bytes`, {})
    }
}

export class ProcessingRequestError extends ErrorBase {
    private static errorCode = EErrorCode.REQUEST_PROCESSING_ERROR
    constructor(err: unknown) {
        // HACK: Expose all fields of forwarded error. Is there a better way to achieve this?
        //       Returning a Dss error only exposes its 'code' field in the
        //       final json output, even if other fields are defined.
        //       Object.getOwnPropertyNames() is used here to forcefully
        //       capture all fields. To see the problem in action, skip
        //       the following block and just return 'err'.
        const result: Record<string, any> = {}
        if (typeof err === "object" && err != undefined) {
            for (const key of Object.getOwnPropertyNames(err)) {
                result[key] = (err as Record<string, unknown>)[key] // eslint-ignore-line
            }
        }

        super(ProcessingRequestError.errorCode, "request processing failed", result)
    }
}

export class UnhandledError extends ErrorBase {
    private static errorCode = EErrorCode.UNHANDLED_ERROR
    constructor(obj: unknown) {
        super(UnhandledError.errorCode, "an unhandled error occurred", JSON.stringify(obj))
    }
}

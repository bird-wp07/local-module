import { Base64, UnixTimeMs } from "../types"
import * as Joi from "joi"
import { HTTP_MAX_REQUEST_BODY_SIZE_BYTES } from "./routes"

export enum EDigestAlgorithm {
    SHA256 = "SHA256"
}

export const Schema_EDigestAlgorithm = Joi.valid(...Object.values(EDigestAlgorithm))

export enum EEncryptionAlgorithm {
    ECDSA = "ECDSA"
}

export const Schema_EEncryptionAlgorithm = Joi.valid(...Object.values(EEncryptionAlgorithm))

export enum ESignatureAlgorithm {
    ECDSA_SHA256 = "ECDSA_SHA256"
}

export enum EHealthStatus {
    OK = "OK",
    DSS_NO_REPLY = "DSS_NO_REPLY"
}
export interface IHealthResponse {
    status: EHealthStatus
}

/**
 * TODOC
 */
export interface IDigestPdfRequest {
    /**
     * Base64 encoded PDF.
     */
    bytes: Base64

    /**
     * Timestamp in ms since epoch.
     */
    timestamp: UnixTimeMs
}

export const Schema_IDigestPdfRequest = Joi.object().keys({
    digestAlgorithm: Schema_EDigestAlgorithm,
    bytes: Joi.string().base64(),
    signingTimestamp: Joi.number().min(0)
})

export interface IDigestPdfResponse {
    bytes: Base64
}

export interface IMergePdfRequest {
    bytes: Base64
    signatureAsCMS: Base64 // TODO: rename field
    signingTimestamp: UnixTimeMs
}

export const Schema_IMergePdfRequest = Joi.object().keys({
    bytes: Joi.string().base64(),
    signatureAsCMS: Joi.string().base64(),
    signingTimestamp: Joi.number().min(0)
})

export interface IMergePdfResponse {
    bytes: Base64
}

export interface IValidateSignedPdfRequest {
    bytes: Base64
}

export const Schema_IValidateSignedPdfRequest = Joi.object().keys({
    bytes: Joi.string().base64()
})

export interface IValidateSignedPdfResponse {
    valid: boolean
    details: unknown
}

/**
 * Errors
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

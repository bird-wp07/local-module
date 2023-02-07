import { Base64 } from "../types"
import * as Joi from "joi"
import { HTTP_MAX_REQUEST_BODY_SIZE_BYTES } from "./routes"

export type UnixTimeMs = number

export enum EDigestAlgorithm {
    SHA256 = "SHA256",
    SHA512 = "SHA512"
}

export const Schema_EDigestAlgorithm = Joi.valid(...Object.values(EDigestAlgorithm))

export interface IDigestPDFRequest {
    digestAlgorithm: EDigestAlgorithm
    bytes: Base64
    signingTimestamp?: UnixTimeMs
}

export const Schema_IDigestPDFRequest = Joi.object().keys({
    digestAlgorithm: Schema_EDigestAlgorithm,
    bytes: Joi.string().base64(),
    signingTimestamp: Joi.number().min(0)
})

export interface IDigestPDFResponse {
    bytes: Base64
}

/**
 * Errors
 */
export enum EErrorCode {
    REQUEST_VALIDATION_ERROR = "REQUEST_VALIDATION_ERROR",
    REQUEST_SIZE_TOO_LARGE = "REQUEST_SIZE_TOO_LARGE",
    UNHANDLED_ERROR = "UNHANDLED_ERROR"
}

export class ErrorBase extends Error {
    code: EErrorCode
    message: string
    detail: any
    constructor(code: EErrorCode, message: string, detail: unknown) {
        super()
        this.code = code
        this.message = message
        this.detail = detail
    }
}

export class RequestValidationError extends ErrorBase {
    static errorCode = EErrorCode.REQUEST_VALIDATION_ERROR
    constructor(detail: any) {
        super(RequestValidationError.errorCode, "request validation failed", detail)
    }
}

export class RequestBodyTooLarge extends ErrorBase {
    static errorCode = EErrorCode.REQUEST_SIZE_TOO_LARGE
    constructor() {
        super(RequestBodyTooLarge.errorCode, `request body size must not exceed ${HTTP_MAX_REQUEST_BODY_SIZE_BYTES} bytes`, {})
    }
}

export class UnhandledError extends ErrorBase {
    static errorCode = EErrorCode.UNHANDLED_ERROR
    constructor(obj: unknown) {
        super(UnhandledError.errorCode, "an unhandled error occurred", JSON.stringify(obj))
    }
}

// HACK: Local namespace imports (import * as Dss from "../../dss") bug out tsoa
//       Generated models, which use types that referred to via prefix (e.g.
//       Dss.EDigestAlgorithm), are wrong and will mess up validation.

import { EDigestAlgorithm, ESignatureValidationIndication, ESignatureValidationSubIndication } from "../../dss"
export type Base64 = string

export interface IDigestBlobRequest {
    bytes: Base64
    digestAlgorithm: EDigestAlgorithm
}

export interface IDigestBlobResponse {
    digest: Base64
}

export interface IDigestPDFRequest {
    digestAlgorithm: EDigestAlgorithm
    bytes: Base64
    signingTimestamp?: number // TODOC: What time format is this?
}

export interface IDigestPDFResponse {
    digest: Base64
}

export interface IMergePDFRequest {
    bytes: Base64
    signatureAsCMS: Base64
    signingTimestamp: number
}

export interface IMergePDFResponse {
    bytes: Base64
}

export interface IValidateSignedPdfResponse {
    result: ESignatureValidationIndication
    reason: ESignatureValidationSubIndication | "NO_SIGNATURE" | null
}

export interface IValidateSignedPdfRequest {
    bytes: Base64
}

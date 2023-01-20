// HACK: Local namespace imports (import * as Dss from "../../dss") bug out tsoa.
//       Generated models, which use types that are referred to via namespace (e.g.
//       Dss.EDigestAlgorithm), are wrong and will mess up validation.
//       See #11.
import { EDigestAlgorithm, ESignatureValidationIndication, ESignatureValidationSubIndication } from "../../dss"
import { Base64 } from "../../types/common"

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
    signingTimestamp?: number // unix ms
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

export interface IGetHealthResponse {
    status: "ok"
}

import { Base64, EDigestAlgorithm } from "../../types/common"

export interface DigestBlobRequest {
    bytes: Base64
    digestAlgorithm: EDigestAlgorithm
}

export interface DigestBlobResponse {
    digest: Base64
}

export interface DigestPDFRequest {
    digestAlgorithm: EDigestAlgorithm
    bytes: Base64
    signingTimestamp?: number // unix ms
}

export interface DigestPDFResponse {
    digest: Base64
}

export interface MergePDFRequest {
    bytes: Base64
    signatureAsCMS: Base64
    signingTimestamp: number
}

export interface MergePDFResponse {
    bytes: Base64
}

export interface ValidateSignedPdfRequest {
    bytes: Base64
}

export interface ValidateSignedPdfResponse {
    result: string
    reason: string | null
}

export interface GetHealthResponse {
    status: "ok"
}

import { Base64, EDigestAlgorithm, ESignatureLevel, ESignaturePackaging, EValidationSteps } from "../../types/common"

export interface GetDataToSignRequest {
    signatureLevel: ESignatureLevel
    signaturePackaging: ESignaturePackaging
    digestAlgorithm: EDigestAlgorithm
    signingTimestamp?: number
    bytes: Base64
}

export interface GetDataToSignResponse {
    digest: Base64
}

export interface MergeDocumentRequest {
    bytes: Base64
    cms?: Base64
    signingTimestamp?: number
}

export interface MergeDocumentResponse {
    bytes: Base64
}

interface Document {
    bytes: Base64
    name?: string
}

export interface ValidateSignedDocumentRequest {
    signedDocument: Document
    originalDocuments?: Document[]
}

export interface ValidateSignedDocumentResult {
    validationStep: EValidationSteps
    passed: boolean
    reason: string | null
}

export interface ValidateSignedDocumentResponse {
    results: ValidateSignedDocumentResult[]
}

export type GetSignatureValueRequest = Pick<ValidateSignedDocumentRequest, "signedDocument">

export interface GetSignatureValueResponse {
    signatureValue: Base64
}

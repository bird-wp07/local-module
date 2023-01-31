import { Base64 } from "../../types/common"

export interface CsSignatureRequest {
    issuerId: string
    hash: Base64
    digestMethod: string
    auditLog: string
}

export interface CsSignatureResponse {
    signatureHash: string
    signature: string
    cms: string
}

export enum EHashType {
    SIGNATURE_HASH = "SIGNATURE_HASH"
}

export interface CsValidationRequest {
    hash: Base64
    hashType: EHashType
}

export interface CsValidationResult {
    policyId: string
    policyDescription: string
    passed: boolean
}

export interface CsValidationResponse {
    valid: boolean
    results: CsValidationResult[]
}

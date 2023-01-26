import { Base64 } from "../../types/common"

export interface SignatureRequest {
    issuerId: string
    hash: Base64
    digestMethod: string
    auditLog: string
}

export interface SignatureResponse {
    signatureHash: string
    signature: string
    cms: string
}

export enum EHashType {
    SIGNATURE_HASH = "SIGNATURE_HASH"
}

export interface ValidationRequest {
    hash: Base64
    hashType: EHashType
}

export interface ValidationResult {
    policyId: string
    policyDescription: string
    passed: boolean
}

export interface ValidationResponse {
    valid: boolean
    results: ValidationResult
}

import { Base64 } from "../../types/common"

export interface ISignatureRequest {
    issuerId: string
    hash: Base64
    digestMethod: string
    auditLog: string
}

export interface ISignatureResponse {
    signatureHash: string
    signature: string
    cms: string
}

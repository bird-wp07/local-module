import { Base64, EDigestAlgorithm, EEncryptionAlgorithm, ESignatureAlgorithm, ESignatureLevel, ESignaturePackaging } from "../../dss/types"

export interface ISigningCertificate {
    encodedCertificate: Base64
}

export interface IDigestParameters {
    signingCertificate?: ISigningCertificate
    signatureLevel?: ESignatureLevel
    signaturePackaging?: ESignaturePackaging
    signatureAlgorithm?: ESignatureAlgorithm
    digestAlgorithm?: EDigestAlgorithm.SHA256 | EDigestAlgorithm.SHA512 | EDigestAlgorithm.SHA1
    encryptionAlgorithm?: EEncryptionAlgorithm
    generateTBSWithoutCertificate?: boolean
    blevelParams?: {
        signingDate?: number
    }
}

export interface IDocument {
    /**
     * base64 encoded document
     */
    bytes: Base64
    name: string
}

export interface IDigestRequest {
    toSignDocument: IDocument
    parameters?: IDigestParameters
}

export interface IDigestResponse {
    digest: string
}

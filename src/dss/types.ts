export enum EDigestAlgorithm { //DSS offers much more options, see public enum DigestAlgorithm
    SHA1 = "SHA1",
    SHA224 = "SHA224",
    SHA256 = "SHA256",
    SHA512 = "SHA512"
}

export enum ESignatureAlgorithm {
    SHA256 = "RSA_SHA256"
}

export enum EEncryptionAlgorithm {
    RSA = "RSA"
}

export enum ASiCContainerType {
    ASiC_S,
    ASiC_E
}

export enum ESignatureLevel {
    PAdES_B = "PAdES_BASELINE_B",
    XAdES_B = "XAdES_BASELINE_B"
}

export enum ESignaturePackaging {
    enveloping = "ENVELOPING"
}

export interface IGetDataToSignRequest {
    toSignDocument: {
        bytes: Base64
        name?: string
    }
    parameters?: {
        signingCertificate?: {
            encodedCertificate: Base64
        }
        signatureLevel?: ESignatureLevel
        signaturePackaging?: ESignaturePackaging
        signatureAlgorithm?: ESignatureAlgorithm
        digestAlgorithm?: EDigestAlgorithm.SHA256 | EDigestAlgorithm.SHA512
        encryptionAlgorithm?: EEncryptionAlgorithm
        generateTBSWithoutCertificate?: boolean
        blevelParams?: {
            signingDate: number
        }
    }
}

export interface IGetDataToSignResponse {
    bytes: Base64
}

export interface IDigestResponse {
    digest: string
}

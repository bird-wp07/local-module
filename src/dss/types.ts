export type Base64 = string

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

/**
 * See https://ec.europa.eu/digital-building-blocks/wikis/display/ESIGKB/What+is+the+packaging+enveloped+-+detached+-+enveloping+and+internally+detached+of+a+signature
 */
export enum ESignaturePackaging {
    enveloping = "ENVELOPING",
    enveloped = "ENVELOPED",
    detached = "DETACHED",
    internallyDetached = "INTERNALLY_DETACHED"
}

/* DSS offers much more options, see public enum DigestAlgorithm */
export enum EDigestAlgorithm {
    SHA1 = "SHA1",
    SHA224 = "SHA224",
    SHA256 = "SHA256",
    SHA512 = "SHA512"
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
        digestAlgorithm?: EDigestAlgorithm
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

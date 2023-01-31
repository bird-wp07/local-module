export type Base64 = string

export enum EDigestAlgorithm {
    SHA256 = "SHA256",
    SHA512 = "SHA512"
}

export enum ESignatureLevel {
    PAdES_B = "PAdES_BASELINE_B",
    XAdES_B = "XAdES_BASELINE_B"
}

/**
 * See https://ec.europa.eu/digital-building-blocks/wikis/display/ESIGKB/What+is+the+packaging+enveloped+-+detached+-+enveloping+and+internally+detached+of+a+signature
 */
export enum ESignaturePackaging {
    ENVELOPED = "ENVELOPED",
    ENVELOPING = "ENVELOPING"
}

export enum ESignatureAlgorithm {
    RSA_SHA256 = "RSA_SHA256",
    ECDSA_SHA256 = "ECDSA_SHA256"
}

export enum EEncryptionAlgorithm {
    RSA = "RSA",
    ECDSA = "ECDSA"
}

export enum EASiCContainerType {
    ASiC_S,
    ASiC_E
}

export enum EValidationSteps {
    SIGNATURE = "signature validation",
    ISSUER = "issuer validation"
}

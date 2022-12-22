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

/** DSS offers much more options, see public enum DigestAlgorithm */
export enum EDigestAlgorithm {
    SHA1 = "SHA1",
    SHA224 = "SHA224",
    SHA256 = "SHA256",
    SHA512 = "SHA512"
}

/**
 * Base64 encoded blob or digest with an optional filename.
 *
 * @field bytes - base64 encoded blob or digest
 * @field digestAlgorithm - the respective digest algorithm used or null/undefined for a raw blob
 * @field name - an optional filename
 */
export interface IBlobOrDigest {
    bytes: Base64
    digestAlgorithm?: EDigestAlgorithm | null
    name?: string
}

export interface IGetDataToSignRequest {
    // TODO: Replace with IBlobOrDigest
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

export interface ISignDataResponse {
    bytes: Base64
}
export interface IDigestResponse {
    digest: string
}
/**
 * Possible results ("indications") of a signature validation. See
 *
 *     https://ec.europa.eu/digital-building-blocks/DSS/webapp-demo/doc/dss-documentation.html#SignatureValidationModel
 *
 * NOTE: In contrast to the documentation, the DSS response uses underscores instead of dashes (e.g. 'TOTAL_PASSED',
 *       not 'TOTAL-PASSED').
 */
export enum ESignatureValidationIndication {
    TOTAL_PASSED = "TOTAL_PASSED",
    INDETERMINATE = "INDETERMINATE",
    TOTAL_FAILED = "TOTAL_FAILED"
}

/**
 * Possible reasons ("subindication") for all possible validation results. See
 *
 *     https://ec.europa.eu/digital-building-blocks/DSS/webapp-demo/doc/dss-documentation.html#SignatureValidationModel
 */
export enum ESignatureValidationSubIndication {
    /* INDETERMINATE reasons. */
    SIG_CONSTRAINTS_FAILURE = "SIG_CONSTRAINTS_FAILURE",
    CHAIN_CONSTRAINTS_FAILURE = "CHAIN_CONSTRAINTS_FAILURE",
    CERTIFICATE_CHAIN_GENERAL_FAILURE = "CERTIFICATE_CHAIN_GENERAL_FAILURE",
    CRYPTO_CONSTRAINTS_FAILURE = "CRYPTO_CONSTRAINTS_FAILURE",
    POLICY_PROCESSING_ERROR = "POLICY_PROCESSING_ERROR",
    SIGNATURE_POLICY_NOT_AVAILABLE = "SIGNATURE_POLICY_NOT_AVAILABLE",
    TIMESTAMP_ORDER_FAILURE = "TIMESTAMP_ORDER_FAILURE",
    NO_SIGNING_CERTIFICATE_FOUND = "NO_SIGNING_CERTIFICATE_FOUND",
    NO_CERTIFICATE_CHAIN_FOUND = "NO_CERTIFICATE_CHAIN_FOUND",
    REVOKED_NO_POE = "REVOKED_NO_POE",
    REVOKED_CA_NO_POE = "REVOKED_CA_NO_POE",
    OUT_OF_BOUNDS_NOT_REVOKED = "OUT_OF_BOUNDS_NOT_REVOKED",
    OUT_OF_BOUNDS_NO_POE = "OUT_OF_BOUNDS_NO_POE",
    REVOCATION_OUT_OF_BOUNDS_NO_POE = "REVOCATION_OUT_OF_BOUNDS_NO_POE",
    CRYPTO_CONSTRAINTS_FAILURE_NO_POE = "CRYPTO_CONSTRAINTS_FAILURE_NO_POE",
    NO_POE = "NO_POE",
    TRY_LATER = "TRY_LATER",
    SIGNED_DATA_NOT_FOUND = "SIGNED_DATA_NOT_FOUND",
    CUSTOM = "CUSTOM",

    /* TOTAL_FAILED reasons. */
    FORMAT_FAILURE = "FORMAT_FAILURE",
    HASH_FAILURE = "HASH_FAILURE",
    SIG_CRYPTO_FAILURE = "SIG_CRYPTO_FAILURE",
    REVOKED = "REVOKED",
    EXPIRED = "EXPIRED",
    NOT_YET_VALID = "NOT_YET_VALID"

    /* NOTE: A TOTAL_PASSED result provides no reasons. */
}

export interface ISignatureOrTimestamp {
    Signature: {
        Indication: ESignatureValidationIndication

        /* A 'null' subindication is returned iff the indication is TOTAL_PASSED. */
        SubIndication: ESignatureValidationSubIndication | null
    }
}

export interface IValidateSignatureResponse {
    SimpleReport: {
        // NOTE: the lowercase 's' is not a typo
        signatureOrTimestamp: ISignatureOrTimestamp[] | null
    }
}

export interface IValidateSignatureRequest {
    signedDocument: IBlobOrDigest
    originalDocuments: IBlobOrDigest[]
    policy: null
    signatureId: null
}

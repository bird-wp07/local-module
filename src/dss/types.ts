import { Base64, UnixTimeMs } from "../types"

/**
 * Possible results ("indications") of a signature validation. See
 * https://ec.europa.eu/digital-building-blocks/DSS/webapp-demo/doc/dss-documentation.html#SignatureValidationModel
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
 * https://ec.europa.eu/digital-building-blocks/DSS/webapp-demo/doc/dss-documentation.html#SignatureValidationModel
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

/**
 * Subset of signature algorithms (tuple of encryption and digest algorithms) known to DSS. Implemented as needed.
 */
export enum ESignatureAlgorithm {
    RSA_SHA256 = "RSA_SHA256",
    ECDSA_SHA256 = "ECDSA_SHA256"
}

/**
 * Subset of encryption algorithms known to DSS. Implemented as needed.
 */
export enum EEncryptionAlgorithm {
    RSA = "RSA",
    ECDSA = "ECDSA"
}

// TODOC
export enum ESignatureLevel {
    PAdES_B = "PAdES_BASELINE_B",
    PAdES_LT = "PAdES_BASELINE_LT",
    PAdES_LTA = "PAdES_BASELINE_LTA",
    XAdES_B = "XAdES_BASELINE_B" // FIXME: Do we need XAdES... ? Aren't we exclusively concerned with PDFs?
}

/**
 * Signature packaging schemes. See
 * https://ec.europa.eu/digital-building-blocks/wikis/display/ESIGKB/What+is+the+packaging+enveloped+-+detached+-+enveloping+and+internally+detached+of+a+signature
 */
export enum ESignaturePackaging {
    ENVELOPING = "ENVELOPING",
    ENVELOPED = "ENVELOPED",
    DETACHED = "DETACHED",
    INTERNALLY_DETACHED = "INTERNALLY_DETACHED"
}

/**
 * Subset of digest algorithms known to DSS. Implemented as needed.
 */
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
            signingDate: UnixTimeMs
        }
    }
}

export interface IGetDataToSignResponse {
    bytes: Base64
}

/** Helper interface */
interface IBlobOrDigest {
    bytes: Base64
    digestAlgorithm?: EDigestAlgorithm | null
    name?: string
}

export interface IValidateSignatureRequest {
    signedDocument: IBlobOrDigest
    originalDocuments: IBlobOrDigest[]
    policy: null
    signatureId: null
}

export interface IValidateSignatureResponse {
    SimpleReport: {
        signatureOrTimestamp: // NOTE: the lowercase 's' is not a typo
        | {
                  Signature: {
                      Indication: ESignatureValidationIndication

                      /* A 'null' subindication is returned iff the indication is TOTAL_PASSED. */
                      SubIndication: ESignatureValidationSubIndication | null
                  }
              }[]
            | null
    }
}

/** Helper interface */
interface IDssCert {
    encodedCertificate: string
}

export interface ISignDocumentRequest {
    toSignDocument?: {
        bytes: Base64
    }
    parameters: {
        signWithExpiredCertificate: false
        generateTBSWithoutCertificate: false
        signatureLevel: ESignatureLevel
        signaturePackaging?: ESignaturePackaging
        signatureAlgorithm?: ESignatureAlgorithm
        encryptionAlgorithm?: EEncryptionAlgorithm
        digestAlgorithm: EDigestAlgorithm
        signingCertificate: IDssCert
        certificateChain: IDssCert[]
        blevelParams?: {
            signingDate: UnixTimeMs
        }
    }
    signatureValue: {
        algorithm: ESignatureAlgorithm
        value: string
    }
}

export interface ISignDocumentResponse {
    bytes: Base64
}

/* ****** */
/* Errors */
/* ****** */

/**
 * Enum of different types of errors. Used as unique error code.
 */
export enum EDssErrorCode {
    NO_RESPONSE = "NO_RESPONSE",
    UNEXPECTED_RESPONSE = "UNEXPECTED_RESPONSE",
    DESERIALIZATION_ERROR = "DESERIALIZATION_ERROR",
    UNEXPECTED_INPUT = "UNEXPECTED_INPUT",
    DOC_CANNOT_BE_MODIFIED = "DOC_CANNOT_BE_MODIFIED",
    CERTIFICATE_NOT_YET_VALID = "CERTIFICATE_NOT_YET_VALID",
    CERTIFICATE_EXPIRED = "CERTIFICATE_EXPIRED",
    UNHANDLED_ERROR = "UNHANDLED_ERROR"
}

/**
 * Base error type for all DSS related errors.
 */
export class DssError extends Error {
    public code: EDssErrorCode
    public constructor(msg: string, code: EDssErrorCode) {
        super(msg)
        this.code = code
    }
}

export class NoResponse extends DssError {
    public constructor() {
        super("DSS server can't be reached", EDssErrorCode.NO_RESPONSE)
    }
}

export class UnexpectedResponse extends DssError {
    public constructor() {
        super("DSS server responded unexpectedly", EDssErrorCode.UNEXPECTED_RESPONSE)
    }
}

export class DeserializationError extends DssError {
    public constructor() {
        super("Error deserializing payload, possibly due to malformed base64", EDssErrorCode.DESERIALIZATION_ERROR)
    }
}

/**
 * Error produced by unexpected (e.g. .docx instead of .pdf) or altogether
 * unrecognized file types.
 */
export class UnexpectedInput extends DssError {
    public constructor() {
        super("Error parsing input file or data, possibly due to unexpected file format", EDssErrorCode.UNEXPECTED_INPUT)
    }
}

/**
 * Error produced when attemting to digest a signed document.
 * ???: Why does this produce an error?
 */
export class DocumentCannotBeModified extends DssError {
    public constructor() {
        super("Document cannot be modified.", EDssErrorCode.DOC_CANNOT_BE_MODIFIED)
    }
}

/**
 * Error indicating a not-yet-valid certificate. May be caused by attempting to
 * merge a signature with a document using a timestamp that's outside the
 * temporal scope of the certificate.
 */
export class CertificateNotYetValid extends DssError {
    public constructor(msg?: string) {
        super(msg ?? "Certificate is not yet valid.", EDssErrorCode.CERTIFICATE_NOT_YET_VALID)
    }
}

/**
 * Error indicating an expired certificate. May be caused by attempting to
 * merge a signature with a document using a timestamp that's outside the
 * temporal scope of the certificate.
 */
export class CertificateExpired extends DssError {
    public constructor(msg?: string) {
        super(msg ?? "Certificate expired.", EDssErrorCode.CERTIFICATE_NOT_YET_VALID)
    }
}

/**
 * Placeholder / fallback error; Occurrence of this error indicates incomplete
 * code paths.
 */
export class UnhandledError extends DssError {
    public constructor(err?: any) {
        if (err !== undefined) {
            super(`Unhandled error: ${JSON.stringify(err)}`, EDssErrorCode.UNHANDLED_ERROR)
        } else {
            super("Unhandled error", EDssErrorCode.UNHANDLED_ERROR)
        }
    }
}

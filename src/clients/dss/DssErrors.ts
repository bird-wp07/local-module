export enum EDssErrorCode {
    NO_RESPONSE = "NO_RESPONSE",
    UNEXPECTED_RESPONSE = "UNEXPECTED_RESPONSE",
    DESERIALIZATION_ERROR = "DESERIALIZATION_ERROR",
    UNEXPECTED_INPUT = "UNEXPECTED_INPUT",
    CERTIFICATE_NOT_YET_VALID = "CERTIFICATE_NOT_YET_VALID",
    CERTIFICATE_EXPIRED = "CERTIFICATE_EXPIRED",
    UNHANDLED_ERROR = "UNHANDLED_ERROR",
    PROPERTY_MISSING = "PROPERTY_MISSING"
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
 *  Error indicating an expired certificate. May be caused by attempting to
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

export class PropertyMissing extends DssError {
    public constructor(propertyName: string) {
        super(`DSS requires a ${propertyName} structure to merge the document and signature`, EDssErrorCode.PROPERTY_MISSING)
    }
}

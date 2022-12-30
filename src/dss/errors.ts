export enum EDssErrorCode {
    NO_RESPONSE = "NO_RESPONSE",
    UNEXPECTED_RESPONSE = "UNEXPECTED_RESPONSE",
    DESERIALIZATION_ERROR = "DESERIALIZATION_ERROR",
    UNEXPECTED_INPUT = "UNEXPECTED_INPUT",
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
 * Placeholder / fallback error; Occurrence of this error indicates incomplete
 * code paths.
 */
export class UnhandledError extends DssError {
    public constructor() {
        super("Unhandled error", EDssErrorCode.UNHANDLED_ERROR)
    }
}

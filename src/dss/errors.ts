export class NoResponse extends Error {
    public constructor() {
        super("DSS server can't be reached.")
    }
}

export class UnexpectedResponse extends Error {
    public constructor() {
        super("DSS server responded unexpectedly.")
    }
}

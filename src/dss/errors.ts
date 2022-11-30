// FIXME: Create Dss.Error ns and merge with Dss ns while keeping these errors in this file.
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

export * as Errors from "./errors"
export * from "./dss-client"

/* NOTE: This file suits as a workaround for typescript's inability to split members
 *       of a namespace up into different files. In order to have the dss-specific
 *       errors in a file separate from the dss-client implementation and to be able
 *       to access both under a common prefix (as if a proper namespace were used)
 *       this auxiliary export file is required. See
 *
 *           https://stackoverflow.com/a/60186593
 */

import * as Cs from "../src/cs"
import * as Dss from "../src/dss"

/**
 * Creates a Cs.CsClient and calls #isOnline(), throwing in case of failure.
 */
export async function makeCsClient(): Promise<Cs.CsClient> {
    const csBaseUrl = process.env.WP07_CS_BASEURL ?? "https://46.83.201.35.bc.googleusercontent.com"
    const csClient = new Cs.CsClient(csBaseUrl)
    const isOnline = await csClient.isOnline()
    if (!isOnline) {
        throw new Error(`CS cannot be reached at '${csClient.baseUrl}'.`)
    }
    return csClient
}

/**
 * Creates a Dss.DssClient and calls #isOnline(), throwing in case of failure.
 */
export async function makeDssClient(): Promise<Dss.DssClient> {
    const dssBaseUrl = process.env.WP07_DSS_BASEURL ?? "http://127.0.0.1:8080"
    const dssClient = new Dss.DssClient(dssBaseUrl)
    const isOnline = await dssClient.isOnline()
    if (!isOnline) {
        throw new Error(`DSS cannot be reached at '${dssClient.baseUrl}'.`)
    }
    return dssClient
}

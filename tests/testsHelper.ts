import * as Cs from "../src/clients/cs"
import { DssClientOptions } from "../src/clients/clientOptions"
import { DssClient } from "../src/clients/dss/dssClient"
import { httpReq } from "../src/utility"
import { HttpClient } from "../src/clients"

/**
 * Creates a Cs.CsClient and calls #isOnline(), throwing in case of failure.
 */
export async function makeCsClient(): Promise<Cs.CsClient> {
    const csBaseUrl = process.env.WP07_CS_BASEURL ?? "http://46.83.201.35.bc.googleusercontent.com"
    const csClient = new Cs.CsClient({ baseUrl: csBaseUrl }, new HttpClient())
    const isOnline = await csClient.isOnline()
    if (!isOnline) {
        throw new Error(`CS cannot be reached at '${csClient.baseUrl}'.`)
    }
    return csClient
}

/**
 * Creates a Dss.DssClient and calls #isOnline(), throwing in case of failure.
 */
export async function makeDssClient(): Promise<DssClient> {
    const dssBaseUrl = process.env.WP07_DSS_BASEURL ?? "http://127.0.0.1:8080"
    const clientOptions: DssClientOptions = { baseUrl: dssBaseUrl }
    const dssClient = new DssClient(new HttpClient(), clientOptions)

    const isOnline = await dssClient.isOnline()
    if (isOnline.isErr() || !isOnline.value.valueOf()) {
        throw new Error(`DSS cannot be reached at '${dssBaseUrl}'.`)
    }
    return dssClient
}

export async function findLm(): Promise<string> {
    const lmBaseUrl = process.env.WP07_LM_BASEURL ?? "http://127.0.0.1:2048"
    const res = await httpReq({
        method: "GET",
        baseURL: lmBaseUrl,
        url: "/system/health"
    })
    if (res.isErr()) {
        throw new Error(`Local Module cannot be reached at '${lmBaseUrl}'.`)
    }
    return lmBaseUrl
}

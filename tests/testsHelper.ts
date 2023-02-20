import * as Cs from "../src/cs"
import * as Dss from "../src/dss"
import * as Settings from "../src/settings"
import * as Utility from "../src/utility"

/**
 * Creates a Cs.CsClient and calls #isOnline(), throwing in case of failure.
 */
export async function makeCsClient(): Promise<Cs.CsClient> {
    const cfg = Settings.parseApplicationSettings()._unsafeUnwrap()
    const csClientMakeResult = Cs.CsClient.make(cfg.csBaseUrl, cfg.csTokenUrl, cfg.csClientPfx, cfg.csClientPfxPassword, cfg.csCaPem)
    if (csClientMakeResult.isErr()) {
        throw new Error("Can't create CS client: '", csClientMakeResult.error)
    }
    const csClient = csClientMakeResult.value

    const isOnline = await csClient.isOnline()
    if (!isOnline) {
        throw new Error(`CS cannot be reached at '${csClient.baseurl}'.`)
    }
    return csClient
}

/**
 * Creates a Dss.DssClient and calls #isOnline(), throwing in case of failure.
 */
export async function makeDssClient(): Promise<Dss.DssClient> {
    const cfg = Settings.parseApplicationSettings()._unsafeUnwrap()
    const dssClient = new Dss.DssClient(cfg.dssBaseurl)
    const isOnline = await dssClient.isOnline()
    if (!isOnline) {
        throw new Error(`DSS cannot be reached at '${dssClient.baseurl}'.`)
    }
    return dssClient
}

/**
 * Attempts to locate a running local module, returning its baseurl.
 */
export async function findLm(): Promise<string> {
    const cfg = Settings.parseApplicationSettings()._unsafeUnwrap()
    const res = await Utility.httpReq({
        method: "GET",
        baseURL: cfg.lmBaseurl,
        url: "/system/health"
    })
    if (res.isErr()) {
        throw new Error(`Local Module cannot be reached at '${cfg.lmBaseurl}'.`)
    }
    return cfg.lmBaseurl
}

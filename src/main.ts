import * as Settings from "./settings"
import { logger } from "./settings"
import * as Dss from "./dss"
import http from "http"
import https from "https"
import { app } from "./server"

let dssClient: Dss.DssClient

async function main() {
    /* Parse application settings. */
    const settingsRes = Settings.parseApplicationSettings()
    if (settingsRes.isErr()) {
        console.error(settingsRes.error.message)
        process.exit(1)
    }
    const settings = settingsRes.value

    /* Wait for DSS startup to fininsh. */
    dssClient = new Dss.DssClient(settings.dssBaseUrl)
    const wait = 3600
    logger.info(`Waiting for DSS to respond at '${settings.dssBaseUrl}' ... `)
    const isOnline = await dssClient.isOnline({ waitSeconds: wait })
    if (isOnline.isErr()) {
        if (isOnline.error instanceof Dss.Errors.NoResponse) {
            logger.error(`DSS server did not respond for ${wait} seconds. Abort.`)
        } else {
            logger.error(`DSS server sent an unexpected response. Abort.`)
        }
        process.exit(1)
    }
    logger.info("DSS responded. Starting HTTP server ... ")

    /* Start our http server. */
    let protocol = "http"
    if (settings.localModuleUseHttps) {
        protocol += "s"
    }
    const initCallback = () => {
        logger.info(`Listening on ${protocol}://${settings.localModuleIp}:${settings.localModulePort}. See '/swagger'.`)
    }
    if (settings.localModuleUseHttps) {
        // NOTE: This code path is currently inactive.
        https.createServer(app).listen(settings.localModulePort, settings.localModuleIp, initCallback)
    } else {
        http.createServer(app).listen(settings.localModulePort, settings.localModuleIp, initCallback)
    }
}

void main()

// HACK: Make dssClient available in digestController
export { dssClient }

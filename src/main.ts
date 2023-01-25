import * as Settings from "./settings"
import { logger } from "./settings"
import http from "http"
import { app } from "./server"
import { DssClient } from "./clients/dss"
import { IDocumentClient } from "./clients"
import { DssClientOptions } from "./clients/ClientOptions"
import { sleepms } from "./utility"

let dssClient: IDocumentClient

async function main() {
    /* Parse application settings. */
    const settingsRes = Settings.parseApplicationSettings()
    if (settingsRes.isErr()) {
        console.error(settingsRes.error.message)
        process.exit(1)
    }
    const settings = settingsRes.value

    /* Wait for DSS startup to fininsh. */
    const dssClientOptions = new DssClientOptions()
    dssClientOptions.baseUrl = settings.dssBaseUrl
    dssClient = new DssClient(dssClientOptions)
    const wait = 3600
    logger.info(`Waiting for DSS to respond at '${settings.dssBaseUrl}' ... `)
    const start = new Date().getTime()
    let isOnline = false
    do {
        const httpReqRes = await dssClient.isOnline()
        if (httpReqRes.isOk() && httpReqRes.value.valueOf()) {
            isOnline = true
            break
        }
        await sleepms(1000)
    } while ((new Date().getTime() - start) / 1000 < wait)

    if (!isOnline) {
        logger.error("DSS didn't respond. Abort.")
        process.exit(1)
    }
    logger.info("DSS responded. Starting HTTP server ... ")

    /* Start our http server. */
    const split = settings.localModuleBaseUrl.split("://")[1].split(":")
    const port = Number(split[1])
    const hostname = split[0]
    http.createServer(app).listen(port, hostname, () => {
        logger.info(`Listening on ${settings.localModuleBaseUrl}. See '/swagger'.`)

        /* Send USR1 signal to process waiting for local module to start up.
         * Used for automated testing. */
        if (process.env.WP07_LOCAL_MODULE_SIGNAL_PID != undefined) {
            const pid = Number(process.env.WP07_LOCAL_MODULE_SIGNAL_PID)
            process.kill(pid, "SIGUSR1")
        }
    })
}

void main()

// HACK: Make dssClient available in digestController
export { dssClient }

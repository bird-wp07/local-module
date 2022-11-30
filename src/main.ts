import { logger, Settings } from "./settings"
import { Dss } from "./dss"
import express from "express"
import http from "http"
import https from "https"

async function main() {
    /* Parse application settings. */
    const settingsRes = Settings.parseApplicationSettings()
    if (settingsRes.isErr()) {
        console.error(settingsRes.error.message)
        process.exit(1)
    }
    const settings = settingsRes.value

    /* Wait for DSS startup to fininsh. */
    const wait = 3600
    logger.info("Waiting for DSS to respond ... ")
    const isOnline = await Dss.isOnline(settings.dssBaseUrl, { waitSeconds: wait })
    if (isOnline) {
        logger.info("DSS responded. Starting HTTP server.")
    } else {
        logger.crit(`Could not reach DSS after ${wait} seconds. Abort.`)
        process.exit(1)
    }

    /* Start http server. */
    const app = express()
    app.get("/", (_req, res) => {
        res.send(`Local module v${process.env.npm_package_version}`)
    })

    let protocol = "http"
    if (settings.localModuleUseHttps) {
        protocol += "s"
    }
    const initCallback = () => {
        logger.info(`Listening on ${protocol}://${settings.localModuleIp}:${settings.localModulePort}.`)
    }
    if (settings.localModuleUseHttps) {
        // NOTE: This code path is currently inactive.
        https.createServer(app).listen(settings.localModulePort, settings.localModuleIp, initCallback)
    } else {
        http.createServer(app).listen(settings.localModulePort, settings.localModuleIp, initCallback)
    }
}

main()

import * as Settings from "./settings"
import { logger } from "./settings"
import * as Dss from "./dss"
import * as Server from "./server"
import * as Ioc from "typescript-ioc"
import http from "http"

async function main() {
    /* Parse application settings. */
    const settingsRes = Settings.parseApplicationSettings()
    if (settingsRes.isErr()) {
        console.error(settingsRes.error.message)
        process.exit(1)
    }
    const settings = settingsRes.value

    /* Wait for DSS startup to fininsh. */
    const dssClient = new Dss.DssClient(settings.dssBaseUrl)
    Ioc.Container.bind(Dss.IDssClient).factory(() => dssClient)
    Ioc.Container.bind(Server.IImpl).to(Server.Impl)
    const wait = 3600
    logger.info(`Waiting for DSS to respond at '${settings.dssBaseUrl}' ... `)
    const isOnline = await dssClient.isOnline({ waitSeconds: wait })
    if (!isOnline) {
        logger.error("DSS didn't respond. Abort.")
        process.exit(1)
    }
    logger.info("DSS responded. Starting HTTP server ... ")

    /* Start our http server. */
    const split = settings.localModuleBaseUrl.split("://")[1].split(":")
    const port = Number(split[1])
    const hostname = split[0]
    http.createServer(Server.makeApp()).listen(port, hostname, () => {
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

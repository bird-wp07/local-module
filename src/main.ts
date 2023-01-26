import * as Settings from "./settings"
import { logger } from "./settings"
import http from "http"
import { app } from "./server"
import { DssClient } from "./clients/dss"
import { HttpClient, IDocumentClient, IHttpClient } from "./clients"
import { DssClientOptions } from "./clients/clientOptions"
import { Container, Scope } from "typescript-ioc"
import "./server/controllers/signatureController"
import "./server/services"

const settingsRes = Settings.parseApplicationSettings()
if (settingsRes.isErr()) {
    console.error(settingsRes.error.message)
    process.exit(1)
}
const settings = settingsRes.value

Container.bind(IHttpClient).to(HttpClient).scope(Scope.Local)
Container.bind(IDocumentClient).to(DssClient).scope(Scope.Singleton)
const dssOptions: DssClientOptions = { baseUrl: settings.dssBaseUrl }
Container.bind(DssClientOptions).factory(() => dssOptions)

function main() {
    /* Parse application settings. */
    const settingsRes = Settings.parseApplicationSettings()
    if (settingsRes.isErr()) {
        console.error(settingsRes.error.message)
        process.exit(1)
    }
    const settings = settingsRes.value

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

main()

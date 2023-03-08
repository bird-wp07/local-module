import { logger } from "./settings"
import * as Settings from "./settings"
import * as Utility from "./utility"
import * as Dss from "./dss"
import * as Cs from "./cs"
import * as Applogic from "./applogic"
import * as Server from "./server"
import * as Ioc from "typescript-ioc"
import http from "http"

async function main() {
    /* Parse application settings. */
    const rsltParseApplicationSettings = Settings.parseApplicationSettings()
    if (rsltParseApplicationSettings.isErr()) {
        console.error(rsltParseApplicationSettings.error.message)
        await Utility.sleepms(3000)
        process.exitCode = 1
        return
    }
    const cfg = rsltParseApplicationSettings.value

    /* Initialize DSS client. */
    // TODO: Use a DSS factory for consistency with Cs.CsClient
    const dssClient = new Dss.DssClient(cfg.dssBaseurl)
    const wait = 3600
    logger.info(`Waiting for DSS to respond at '${cfg.dssBaseurl}' ... `)
    const isOnline = await dssClient.isOnline({ waitSeconds: wait })
    if (!isOnline) {
        logger.error("DSS didn't respond. Abort.")
        await Utility.sleepms(3000)
        process.exitCode = 1
        return
    }
    logger.info("DSS responded. Starting HTTP server ... ")

    /* Initialize central service client. */
    const rsltMakeCsClient = Cs.CsClient.make(cfg.csBaseUrl, cfg.csTokenUrl, cfg.csClientPfx, cfg.csClientPfxPassword, cfg.csCaPem)
    if (rsltMakeCsClient.isErr()) {
        logger.error("Couldn't create CsClient. Abort.", rsltMakeCsClient.error)
        await Utility.sleepms(3000)
        process.exitCode = 1
        return
    }
    const csClient = rsltMakeCsClient.value

    /* Ioc container setup. */
    Ioc.Container.bind(Dss.IDssClient).factory(() => dssClient)
    Ioc.Container.bind(Cs.ICsClient).factory(() => csClient)
    Ioc.Container.bind(Applogic.IAppLogic).to(Applogic.AppLogic)

    /* Start our http server. */
    const split = cfg.lmBaseurl.split("://")[1].split(":")
    const port = Number(split[1])
    const hostname = split[0]
    const exposeSecuredRoutes = !!cfg.csTokenUrl && !!cfg.csClientPfx && !!cfg.csClientPfxPassword && !!cfg.csCaPem
    http.createServer(Server.makeApp(exposeSecuredRoutes)).listen(port, hostname, () => {
        if (!exposeSecuredRoutes) {
            logger.info(`One or more authentication credentials have not been provided. Secured routes will not be exposed.`)
        }
        logger.info(`Listening on ${cfg.lmBaseurl}. See '${Server.swaggerUiPath}'.`)

        /* Send USR1 signal to process waiting for local module to start up.
         * Used for automated testing. */
        if (process.env.WP07_LOCAL_MODULE_SIGNAL_PID != undefined) {
            const pid = Number(process.env.WP07_LOCAL_MODULE_SIGNAL_PID)
            process.kill(pid, "SIGUSR1")
        }
    })
}

void main()

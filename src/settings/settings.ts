import fs from "fs"
import url from "url"
import { ok, err, Result } from "neverthrow"
import * as Utility from "../utility"
import { createLogger, transports, format } from "winston"
import { Errors } from "."

/* Export names of envvars for testing purposes. */
export const localModulePortEnvvar = "WP07_LOCAL_MODULE_PORT"
export const dssBaseUrlEnvvar = "WP07_DSS_BASE_URL"

/* Initialize project-wide logger. */
export const logger = createLogger({
    transports: [new transports.Console()],
    level: process.env.DEBUG ? "debug" : "info",
    format: format.combine(
        format.timestamp(),
        format.colorize({
            level: true,
            colors: {
                info: "bold green",
                error: "bold red",
                warn: "bold yellow",
                debug: "bold gray"
            }
        }),
        format.printf(({ level, message }) => {
            return `[local-module] ${level}: ${message as string}`
        })
    )
})

export interface IApplicationSettings {
    /* Local module configuration. Parsed from the 'WP07_LOCAL_MODULE_PORT'
     * envvar. */
    localModuleUseHttps: boolean // TODO: Remove
    // TODO: expose ip so that containers can use 0.0.0.0
    localModuleIp: string // hostname or ip
    localModulePort: number

    /* Base url of the DSS API. Parsed from the 'WP07_DSS_BASE_URL' envvar. */
    dssBaseUrl: string // always has a trailing slash
}

export function parseApplicationSettings(env = process.env): Result<IApplicationSettings, Errors.MissingEnvvar | Errors.InvalidEnvvarValue | Error> {
    /* Merge environment with .env file, if provided. Existing envvars are
     * not overwritten by the contents of the .env file. */
    if (fs.existsSync(".env")) {
        const parseRes = Utility.parseKeyValueFile(".env")
        if (parseRes.isErr()) {
            return err(parseRes.error)
        }
        env = { ...parseRes.value, ...env }
    }

    /* Validate local module settings. */
    if (env[localModulePortEnvvar] == undefined) {
        return err(new Errors.MissingEnvvar(localModulePortEnvvar))
    }
    const localModulePort = Number(env[localModulePortEnvvar])
    if (!Utility.isValidPort(localModulePort)) {
        return err(new Errors.InvalidEnvvarValue(localModulePortEnvvar, env[localModulePortEnvvar]))
    }

    /* Destructure DSS base url and validate its fields. We assert that
     * the protocol is http/https and no additional fields outside of
     * protocol, host and path are specified by the url.
     *
     * NOTE: The protocol parsed from a url by the urllib always
     *       contains a trailing colon. */
    if (env[dssBaseUrlEnvvar] == undefined) {
        return err(new Errors.MissingEnvvar(dssBaseUrlEnvvar))
    }

    try {
        const urlStruct = new url.URL(env[dssBaseUrlEnvvar])
        if (!["http:", "https:"].includes(urlStruct.protocol)) {
            return err(new Errors.InvalidEnvvarValue(dssBaseUrlEnvvar, env[dssBaseUrlEnvvar], `Only 'http' and 'https' are supported.`))
        } else if (urlStruct.port !== "" && !Utility.isValidPort(Number(urlStruct.port))) {
            /* If the default port for http or https is used, the .port
             * field is empty. We thus have to process this special case. */
            return err(new Errors.InvalidEnvvarValue(dssBaseUrlEnvvar, env[dssBaseUrlEnvvar], `Invalid port: '${urlStruct.port}'.`))
        } else if (urlStruct.username !== "" || urlStruct.password !== "" || urlStruct.search !== "" || urlStruct.hash !== "") {
            throw new Error()
        }
    } catch (error: unknown) {
        return err(new Errors.InvalidEnvvarValue(dssBaseUrlEnvvar, env[dssBaseUrlEnvvar]))
    }

    /* Append a trailing slash to the base url for consistency. */
    let dssBaseUrl = env[dssBaseUrlEnvvar]
    if (!dssBaseUrl.endsWith("/")) {
        dssBaseUrl += "/"
    }

    const result: IApplicationSettings = {
        localModuleUseHttps: false,
        localModuleIp: "localhost",
        localModulePort: localModulePort,
        dssBaseUrl: env[dssBaseUrlEnvvar]
    }
    return ok(result)
}

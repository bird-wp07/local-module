import fs from "fs"
import url from "url"
import { ok, err, Result } from "neverthrow"
import * as Utility from "../utility"
import { createLogger, transports, format } from "winston"
import { Errors } from "."

/* Export names of envvars for testing purposes.
 */
export const localModuleBaseUrlEnvvar = "WP07_LOCAL_MODULE_BASEURL"
export const dssBaseUrlEnvvar = "WP07_DSS_BASEURL"

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
    /* Local module origin. Parsed from the 'WP07_LOCAL_MODULE_BASEURL' envvar.
     * Never has a trailing slash. */
    /* NOTE: The local module base url technically specifies the so-called 'origin'
     *       as opposed to a base url. But we'll refer to it as base url for the
     *       sake of simplicity. See
     *           https://developer.mozilla.org/en-US/docs/Web/API/Location
     */
    localModuleBaseUrl: string

    /* Base url of the DSS API. Parsed from the 'WP07_DSS_BASEURL' envvar.
     * Never has a trailing slash. */
    dssBaseUrl: string
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

    /* Destructure base urls and validate their fields. We assert that
     * the protocol is http and no additional fields outside of
     * protocol, hostname and port are specified by the url.
     *
     * NOTE: The protocol parsed from a url by the urllib always
     *       contains a trailing colon. */
    for (const envvar of [dssBaseUrlEnvvar, localModuleBaseUrlEnvvar]) {
        if (env[envvar] == undefined) {
            return err(new Errors.MissingEnvvar(envvar))
        }

        const envvarVal: string = env[envvar]!
        try {
            const urlStruct = new url.URL(envvarVal)
            if ("http:" !== urlStruct.protocol) {
                return err(new Errors.InvalidEnvvarValue(envvar, envvarVal, "Only 'http' is supported."))
            } else if (urlStruct.port !== "" && !Utility.isValidPort(Number(urlStruct.port))) {
                /* If the default port for http (or https) is used, the .port
                 * field is empty. We thus have to process this special case. */
                return err(new Errors.InvalidEnvvarValue(envvar, envvarVal, `Invalid port: '${urlStruct.port}'.`))
            } else if (urlStruct.username !== "" || urlStruct.password !== "" || urlStruct.search !== "" || urlStruct.hash !== "" || urlStruct.pathname !== "/") {
                return err(new Errors.InvalidEnvvarValue(envvar, envvarVal, "Invalid base url."))
            }
        } catch (error: unknown) {
            return err(new Errors.InvalidEnvvarValue(envvar, envvarVal))
        }

        if (envvarVal.endsWith("/")) {
            return err(new Errors.InvalidEnvvarValue(envvar, envvarVal, "Trailing slash not allowed in base url."))
        }
    }

    const result: IApplicationSettings = {
        localModuleBaseUrl: env[localModuleBaseUrlEnvvar]!,
        dssBaseUrl: env[dssBaseUrlEnvvar]!
    }
    return ok(result)
}

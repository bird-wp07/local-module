import fs from "fs"
import { ok, err, Result } from "neverthrow"
import { isIP } from "net"
import isValidHostname from "is-valid-hostname"
import { Utility } from "./utility"

export namespace Settings {
    export namespace Errors {
        export class InvalidSettings extends Error {
            public constructor(message: string) {
                super(message)
            }
        }
    }

    export interface IApplicationSettings {
        /* Local module address to expose the local module http interface at.
         * Parsed from the 'WP07_LOCAL_MODULE_ADDRESS' envvar. */
        localModuleIp: string
        localModulePort: number

        /* Address of the DSS module. Parsed from the 'WP07_DSS_ADDRESS' envvar. */
        dssIp: string
        dssPort: number
    }

    export function parseApplicationSettings(env = process.env): Result<IApplicationSettings, Errors.InvalidSettings | Error> {
        /* Merge environment with .env file, if provided. Existing envvars are
         * not overwritten by the contents of the .env file. */
        if (fs.existsSync(".env")) {
            const parseRes = Utility.parseKeyValueFile(".env")
            if (parseRes.isErr()) {
                return err(parseRes.error)
            }
            env = { ...parseRes.value, ...env }
        }

        /* Validate and parse environment variables. */
        const reMatches = []
        for (const envvar of ["WP07_LOCAL_MODULE_ADDRESS", "WP07_DSS_ADDRESS"]) {
            if (env[envvar] == undefined) {
                return err(new Errors.InvalidSettings(`Mandatory environment variable '${envvar}' is not set.`))
            }

            const match = (env[envvar] as string).match(/^(.+):(\d+)$/)
            if (match == null) {
                return err(new Errors.InvalidSettings(`Mandatory environment variable '${envvar}' does not match the pattern '<IP/HOSTNAME>:<PORT>'.`))
            }

            const ip = match[1]
            if (!isIP(ip) && !isValidHostname(ip)) {
                return err(new Errors.InvalidSettings(`Mandatory environment variable '${envvar}' carries an invalid IP or hostname: '${ip}'.`))
            }

            const port = Number(match[2])
            if (port < 0 || 65535 < port) {
                return err(new Errors.InvalidSettings(`Mandatory environment variable '${envvar}' carries an invalid port: '${port}'.`))
            }

            reMatches.push(match)
        }

        const result: IApplicationSettings = {
            localModuleIp: reMatches[0][1],
            localModulePort: Number(reMatches[0][2]),
            dssIp: reMatches[1][1],
            dssPort: Number(reMatches[1][2])
        }
        return ok(result)
    }
}

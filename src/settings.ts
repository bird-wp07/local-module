import { ok, err, Result } from "neverthrow"

export namespace Settings {
    export namespace Errors {
        export class InvalidSettings extends Error {
            public constructor(message: string) {
                super(message)
            }
        }
    }

    export interface IApplicationSettings {
        /* Local port to expose the local module http interface at. */
        localModulePort: number

        /* IP address of the DSS module in <HOST>:<PORT> format. */
        dssAddress: string
    }

    export function parseApplicationSettings(env = process.env): Result<IApplicationSettings, Errors.InvalidSettings> {
        /* Validate local module port setting. */
        if (typeof env.WP07_LOCAL_MODULE_PORT !== "number" || env.WP07_LOCAL_MODULE_PORT < 1 || env.WP07_LOCAL_MODULE_PORT > 65535 ){
                return err(new Errors.InvalidSettings(`Mandatory environment variable 'WP07_LOCAL_MODULE_PORT' must be a valid port.`))
        }

        /* Validate DSS address setting. */
        if (typeof env.WP07_LOCAL_MODULE_PORT !== "string" /* TODO: Check for <HOST>:<PORT> format via regex. */){
                return err(new Errors.InvalidSettings(`Mandatory environment variable 'WP07_DSS_ADDRESS' must be a valid address .`))
        }
    }
}

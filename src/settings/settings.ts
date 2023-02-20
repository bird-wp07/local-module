import fs from "fs"
import { ok, err, Result } from "neverthrow"
import * as Utility from "../utility"
import { createLogger, transports, format } from "winston"
import * as Joi from "joi"
import { InvalidEnvvarValue } from "./errors"

/**
 * Dict of all runtime configuration parameters, the name of the envvar from
 * which their values are derived, the values' defaults and their joi validation
 * schemas.
 *
 * All parameters are configured via environment variables first and foremost.
 * Optionally, an additional UTF-8 encoded file named '.env' containing lines
 * in 'key=value' format can be used to augment the environment (parameters
 * already configured via their respective envvar will not be overwritten). The
 * .env file's default path can be changed via the $WP07_LOCAL_MODULE_ENVFILE
 * envvar.
 */
export const configParams = {
    /*
     * Specify alternative path of .env file, used to configure settings in
     * addition to the environment.
     */
    lmEnvfilePath: {
        envvar: "WP07_LOCAL_MODULE_ENVFILE",
        default: ".env",
        schema: Joi.string()
    },

    /*
     * Winston log level.
     */
    lmLogLevel: {
        envvar: "WP07_LOCAL_MODULE_LOGLEVEL",
        default: "info",
        schema: Joi.string().valid("debug", "info")
    },

    /*
     * Local module baseurl. This parameter is used to set the local ip address
     * and the port of the local module's webserver. Use an explicit ip address
     * instead of localhost, as nodejs resolves 'localhost' to either ipv4 or
     * ipv6 depending on its version.
     */
    lmBaseurl: {
        envvar: "WP07_LOCAL_MODULE_BASEURL",
        default: "http://127.0.0.1:2048",
        schema: Joi.string(/* TODO: enforce long form SCHEME://HOSTNAME:PORT */).required()
    },

    /*
     * DSS baseurl.
     *
     * The ip address must be 127.0.0.1 due to limitations in the ability to
     * configure the DSS demonstration webapp. See
     * https://github.com/esig/dss-demonstrations/issues/44.
     */
    dssBaseurl: {
        envvar: "WP07_DSS_BASEURL",
        default: "http://127.0.0.1:8080",
        schema: Joi.string(/* TODO: enforce IP == 127.0.0.1 and usage of long form: SCHEME://127.0.0.1:PORT */).required()
    },

    /*
     * Central service base url.
     */
    csBaseUrl: {
        envvar: "WP07_CS_BASEURL",
        schema: Joi.string().required()
    },

    /*
     * Central service issuer ID to be sent along with signature requests.
     */
    csIssuerId: {
        envvar: "WP07_CS_ISSUER_ID",
        schema: Joi.string().required()
    },

    /*
     * Central service's openid-connect auth token url.
     */
    csTokenUrl: {
        envvar: "WP07_CS_TOKEN_URL",
        schema: Joi.string().required()
    },

    /*
     * Path to file containing mTLS client certificate and privkey in PKCS12
     * format. Used for requesting auth tokens.
     */
    csClientPfx: {
        envvar: "WP07_CS_CLIENT_PFX",
        schema: Joi.string().required()
    },

    /*
     * Passphrase for the above file.
     */
    csClientPfxPassword: {
        envvar: "WP07_CS_CLIENT_PFX_PASSWORD",
        schema: Joi.string().required()
    },

    /*
     * Path to file containing self-signed TLS server certificate in PEM
     * format. Used for requesting auth tokens.
     */
    csCaPem: {
        envvar: "WP07_CS_CA_PEM",
        schema: Joi.string().required()
    }
}

/*
 * Initialize project-wide logger. Log level is configured via envvar.
 */
export const logger = createLogger({
    transports: [new transports.Console()],
    level: process.env[configParams.lmLogLevel.envvar] ?? configParams.lmLogLevel.default,
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

// TODO: Infer types from return values of schema field
// TODO: Refer to keys in configParams; DRY
export interface IApplicationSettings {
    lmBaseurl: string
    dssBaseurl: string
    csBaseUrl: string
    csIssuerId: string
    csTokenUrl: string
    csClientPfx: string
    csClientPfxPassword: string
    csCaPem: string
}

/**
 *
 * We allow to pick another dict instead of process.env to allow this function
 * to be tested.
 *
 * FIXME: Use proper types in implementation
 */
export function parseApplicationSettings(env = process.env): Result<IApplicationSettings, Error> {
    /* Merge environment with .env file, if provided. Existing envvars are
     * not overwritten by the contents of the .env file. */
    const envFile = process.env[configParams.lmEnvfilePath.envvar] ?? configParams.lmEnvfilePath.default
    if (fs.existsSync(envFile)) {
        logger.debug(`Parsing env file '${envFile}'`)
        const parseRes = Utility.parseKeyValueFile(".env")
        if (parseRes.isErr()) {
            return err(parseRes.error)
        }
        env = { ...parseRes.value, ...env }
    }

    /* For every configuration setting validate its value. */
    const result: Record<any, any> = {}
    for (const k of Object.keys(configParams)) {
        const key = k as keyof typeof configParams
        const val = env[configParams[key].envvar]
        const validationResult = configParams[key].schema.validate(val)
        if (validationResult.error !== undefined) {
            return err(new InvalidEnvvarValue(configParams[key].envvar, val, validationResult.error.details))
        }
        result[key] = val
    }
    return ok(result as IApplicationSettings)
}

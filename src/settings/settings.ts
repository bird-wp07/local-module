import fs from "fs"
import { ok, err, Result } from "neverthrow"
import * as Utility from "../utility"
import { createLogger, transports, format } from "winston"
import * as Joi from "joi"
import { InvalidEnvvarValue } from "./errors"

/**
 * Dict of all configuration parameters, their defaults and their joi
 * validation schemas. All configuration parameters are set via environment
 * variables.
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
     * Winston log level
     */
    lmLogLevel: {
        envvar: "WP07_LOCAL_MODULE_LOGLEVEL",
        default: "debug",
        schema: Joi.string().valid("debug", "info")
    },

    /*
     * Local module origin
     */
    lmBaseurl: {
        envvar: "WP07_LOCAL_MODULE_BASEURL",
        default: "http://127.0.0.1:2048",
        schema: Joi.string(/* TODO: enforce long form SCHEME://HOSTNAME:PORT */).required()
    },

    /*
     * DSS origin
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
     * Central service auth token url.
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

// FIXME: Use proper typing below.
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

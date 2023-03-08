import fs from "fs"
import { ok, err, Result } from "neverthrow"
import * as Utility from "../utility"
import * as Joi from "joi"
import * as path from "path"
import { InvalidEnvvarValue } from "./errors"
import * as winston from "winston"
import DailyRotateFile from "winston-daily-rotate-file"
import { StrictOmit } from "ts-essentials"

/**
 * Winston logger to be used everywhere. Is properly initialized below.
 */
export let logger = winston.createLogger()

/**
 * Dict of all runtime configuration parameters, the name of the envvar from
 * which their values are derived and their joi validation schemas, where
 * applicable with defaults.
 *
 * All parameters are configured via environment variables first and foremost.
 * Optionally, an additional UTF-8 encoded file named '.env' containing lines
 * in 'key=value' format can be used to augment the environment (parameters
 * already configured via their respective envvar will not be overwritten). The
 * .env file's default path can be changed via the $WP07_LOCAL_MODULE_ENVFILE
 * envvar.
 */
export const envfile = {
    envvar: "WP07_LOCAL_MODULE_ENVFILE",
    default: ".env"
}
export const configParams = {
    /*
     * Winston log level.
     */
    lmLogLevel: {
        envvar: "WP07_LOCAL_MODULE_LOGLEVEL",
        schema: Joi.string().optional().valid("debug", "info").default("debug")
    },

    /*
     * Directory to store log files in. If left empty no log files will be
     * created. Directory will be created, if necessary.
     */
    lmLogDir: {
        envvar: "WP07_LOCAL_MODULE_LOGDIR",
        schema: Joi.string().optional().allow("").default("")
    },

    /*
     * Local module baseurl. This parameter is used to set the local ip address
     * and the port of the local module's webserver. Use an explicit ip address
     * instead of localhost, as nodejs resolves 'localhost' to either ipv4 or
     * ipv6 depending on its version.
     */
    lmBaseurl: {
        envvar: "WP07_LOCAL_MODULE_BASEURL",
        schema: Joi.string(/* TODO: enforce long form SCHEME://HOSTNAME:PORT */).required().default("http://127.0.0.1:2048")
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
        schema: Joi.string(/* TODO: enforce IP == 127.0.0.1 and usage of long form: SCHEME://127.0.0.1:PORT */).required().default("http://127.0.0.1:8080")
    },

    /*
     * Central service base url.
     */
    csBaseUrl: {
        envvar: "WP07_CS_BASEURL",
        schema: Joi.string().required()
    },

    /*
     * Central service's openid-connect auth token url.
     *
     * If this parameter is not set, the authenticated, mTLS secured
     * routes won't be exposed by the HTTP api.
     */
    csTokenUrl: {
        envvar: "WP07_CS_TOKEN_URL",
        schema: Joi.string().allow("").default("")
    },

    /*
     * Path to file containing mTLS client certificate and privkey in PKCS12
     * format. Used for requesting auth tokens.
     *
     * If this parameter is not set, the authenticated, mTLS secured
     * routes won't be exposed by the HTTP api.
     */
    csClientPfx: {
        envvar: "WP07_CS_CLIENT_PFX",
        schema: Joi.string().allow("").default("")
    },

    /*
     * Passphrase for the above file.
     *
     * If this parameter is not set, the authenticated, mTLS secured
     * routes won't be exposed by the HTTP api.
     */
    csClientPfxPassword: {
        envvar: "WP07_CS_CLIENT_PFX_PASSWORD",
        schema: Joi.string().allow("").default("")
    },

    /*
     * Path to file containing self-signed TLS server certificate in PEM
     * format. Used for requesting auth tokens.
     *
     * If this parameter is not set, the authenticated, mTLS secured
     * routes won't be exposed by the HTTP api.
     */
    csCaPem: {
        envvar: "WP07_CS_CA_PEM",
        schema: Joi.string().allow("").default("")
    }
}

/**
 * Helper to parse envvars, to validate their values and to set the defaults.
 */
function parseParam(param: keyof typeof configParams, env = process.env): Result<string, InvalidEnvvarValue> {
    const valFromEnv = env[configParams[param].envvar]
    const valRes = configParams[param].schema.validate(valFromEnv)
    if (valRes.error != undefined) {
        return err(new InvalidEnvvarValue(configParams[param].envvar, valFromEnv, valRes.error.details))
    }
    return ok(valRes.value)
}

/**
 * Returns subset of settings required by the server implementation. Excludes
 * the parameters pertaining to logging, which are only needed here to configure
 * the logger.
 */
export type IApplicationSettings = StrictOmit<Record<keyof typeof configParams, string>, "lmLogLevel" | "lmLogDir">
export function parseApplicationSettings(env = process.env): Result<IApplicationSettings, Error> {
    /* Merge environment with envfile, if provided. Existing envvars are not
     * overwritten by the contents of the .env file. */
    const envfilePath = process.env[envfile.envvar] ?? envfile.default
    if (fs.existsSync(envfilePath)) {
        const rsltParse = Utility.parseKeyValueFile(".env")
        if (rsltParse.isErr()) {
            return err(rsltParse.error)
        }
        env = { ...rsltParse.value, ...env }
    }

    /*
     * Initialize logger.
     *
     * Parse logfile path and log level from environment. */
    const rsltParseLogdir = parseParam("lmLogDir", env)
    if (rsltParseLogdir.isErr()) {
        return err(rsltParseLogdir.error)
    }
    const logdir = rsltParseLogdir.value

    const rsltParseLoglevel = parseParam("lmLogLevel", env)
    if (rsltParseLoglevel.isErr()) {
        return err(rsltParseLoglevel.error)
    }
    const loglvl = rsltParseLoglevel.value

    /* Configure terminal logger. */
    const transports = [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.colorize({
                    level: true,
                    colors: {
                        info: "bold green",
                        error: "bold red",
                        warn: "bold yellow",
                        debug: "bold gray"
                    }
                }),
                winston.format.printf(({ level, message }) => {
                    return `[local-module] ${level}: ${message as string}`
                })
            )
        })
    ] as any[]

    /* Configure logfile output. */
    if (logdir != "") {
        transports.push(
            new DailyRotateFile({
                filename: path.join(logdir, "local-module-%DATE%.log"),
                utc: true,
                auditFile: "",
                zippedArchive: false,
                format: winston.format.combine(winston.format.timestamp(), winston.format.json())
            })
        )
    }

    logger = winston.createLogger({
        transports: transports,
        level: loglvl
    })

    /* For every configuration setting validate its value. */
    const result: Record<any, any> = {}
    for (const k of Object.keys(configParams)) {
        const param = k as keyof typeof configParams
        const rsltParse = parseParam(param, env)
        if (rsltParse.isErr()) {
            return err(rsltParse.error)
        }
        const val = rsltParse.value
        result[param] = val
    }
    return ok(result as IApplicationSettings)
}

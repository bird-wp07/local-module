import fs from "fs"
import util from "util"
import { ok, err, Result } from "neverthrow"
import { AxiosRequestConfig, AxiosResponse, AxiosError } from "axios"
import axios from "axios"

/* eslint-disable */ // disable eslint to use &{} Hack; See https://github.com/microsoft/TypeScript/issues/31940.

/**
 * Base64 encoded binary.
 */
export type Base64 = string & {}

/**
 * Unix time in milliseconds.
 */
export type UnixTimeMs = number & {}
/* eslint-enable */

/**
 * Neverthrow axios wrapper.
 */
export async function httpReq(config: AxiosRequestConfig): Promise<Result<AxiosResponse, AxiosError | Error>> {
    try {
        const response = await axios(config)
        return ok(response)
    } catch (error: unknown) {
        if (error instanceof AxiosError || error instanceof Error) {
            return err(error)
        }
        return err(new Error("An unhandled error occurred."))
    }
}

export async function sleepms(ms: number) {
    return util.promisify(setTimeout)(ms)
}

/**
 * Parses a file of utf-8 encoded, single-line key=value pairs. Lines
 * starting with a literal '#' character are ignored, as well as lines not
 * containing a literal '='. The first literal '=' character is used to
 * split key from value.
 *
 * Both linux ('\n') and windows ('\r\n') EOL characters are supported.
 *
 * This serves as a simple 'dotenv' replacement. 'dotenv' necessarily
 * overrides process.env, whereas for testing purposes it is preferable to
 * pass around explicit objects. Merging the parsed kv-pairs with
 * process.env can be done in a separate, trivial step.
 */
export function parseKeyValueFile(path: string): Result<Record<string, string>, Error> {
    let lines: string[]
    try {
        lines = fs.readFileSync(path, "utf-8").split(/\r?\n/)
    } catch (error: unknown) {
        return err(new Error(`Error reading file '${path}'`))
    }

    const result: Record<string, string> = {}
    for (const line of lines) {
        const n = line.search("=")
        if (line.length === 0 || line.startsWith("#") || n === -1 || n === 0) {
            continue
        }
        const key = line.slice(0, n)
        const value = line.slice(n + 1)
        result[key] = value
    }

    return ok(result)
}

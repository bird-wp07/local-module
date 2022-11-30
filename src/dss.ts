import { AxiosResponse } from "axios"
import { Utility } from "./utility"

export namespace Dss {
    /*
     * Checks whether the DSS API is accessible at the specified ip/hostname
     * and port by querying the DSS's default browser API.
     *
     * If 'waitSeconds' is set, this request is repeated until the set time has
     * passed or a reply is received from the server.
     */
    export async function isOnline(
        baseUrl: string,
        options?: {
            waitSeconds?: number
        }
    ): Promise<boolean> {
        const waitSeconds = options?.waitSeconds ? options.waitSeconds : 0
        const start = new Date().getTime() // returns unix seconds

        const config = {
            url: baseUrl,
            method: "GET",
            timeout: 3000
        }
        do {
            const httpReqRes = await Utility.httpReq(config)
            if (httpReqRes.isOk()) {
                return true
            }
            Utility.sleepms(1000)
        } while ((new Date().getTime() - start) / 1000 < waitSeconds)

        // TODO: Check for title tag '<title>DSS Demonstration WebApp</title>'
        return false
    }
}

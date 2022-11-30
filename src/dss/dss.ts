import { ok, err, Result } from "neverthrow"
import { AxiosRequestConfig, AxiosResponse } from "axios"
import { Utility } from "../utility"
import { Errors } from "."

export namespace Dss {
    /*
     * Checks whether the DSS API is accessible at the specified ip/hostname
     * and port by querying the DSS's default browser API.
     *
     * If 'waitSeconds' is set, this request is repeated until the set time has
     * passed or a reply is received from the server.
     */
    export async function isOnline(baseUrl: string, options?: { waitSeconds?: number }): Promise<Result<null, Errors.NoResponse | Errors.UnexpectedResponse>> {
        const waitSeconds = options?.waitSeconds ? options.waitSeconds : 0
        const start = new Date().getTime() // returns unix seconds

        let responseData = ""
        let gotResponse = false
        const config: AxiosRequestConfig = {
            baseURL: baseUrl,
            method: "GET",
            timeout: 3000
        }
        do {
            const httpReqRes = await Utility.httpReq(config)
            if (httpReqRes.isOk()) {
                responseData = JSON.stringify(httpReqRes.value.data) // ???: What's axios default encoding?
                gotResponse = true
                break
            }
            Utility.sleepms(1000)
        } while ((new Date().getTime() - start) / 1000 < waitSeconds)

        /* Fail if we timed out or if we didn't get the expected response. */
        if (!gotResponse) {
            return err(new Errors.NoResponse())
        }
        if (responseData.length == 0 || !responseData.includes("<title>DSS Demonstration WebApp</title>")) {
            return err(new Errors.UnexpectedResponse())
        }
        return ok(null)
    }
}

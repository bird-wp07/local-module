import { AxiosRequestConfig } from "axios"
import { ok, err, Result } from "neverthrow"
import { ISignatureResponse, ISignatureRequest } from "./types"
import * as Utility from "../utility"

export class CsClient {
    public baseUrl: string
    constructor(baseUrl: string) {
        this.baseUrl = baseUrl
    }

    /**
     * Returns true iff the CS reponds to requests.
     */
    async isOnline(): Promise<boolean> {
        // COMBAK: Eventually use the central service's /health endpoint.
        const config: AxiosRequestConfig = {
            method: "GET",
            url: "/swagger-ui/index.html",
            baseURL: this.baseUrl
        }
        const response = await Utility.httpReq(config)
        if (response.isErr()) {
            return false
        }
        return true
    }

    // TODO: Rename
    async getSignedCms(request: ISignatureRequest): Promise<Result<ISignatureResponse, Error>> {
        const config: AxiosRequestConfig = {
            method: "POST",
            url: "/api/v1/signer/issuances",
            baseURL: this.baseUrl,
            data: request
        }
        const response = await Utility.httpReq(config)
        if (response.isErr()) {
            return err(response.error)
        }
        return ok(response.value.data)
    }
}

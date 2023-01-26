import { ok, err, Result } from "neverthrow"
import { ISignatureResponse, ISignatureRequest } from "./types"
import { Inject } from "typescript-ioc"
import { IHttpClient } from "../httpClient"
import { ISignatureServiceClient } from "../ISignatureServiceClient"
import { CsClientOptions } from "../clientOptions"

export class CsClient implements ISignatureServiceClient {
    public baseUrl: string
    constructor(@Inject options: CsClientOptions, @Inject private httpClient: IHttpClient) {
        this.httpClient.setBaseUrl(options.baseUrl)
        this.baseUrl = options.baseUrl
    }
    /**
     * Returns true iff the CS reponds to requests.
     */
    async isOnline(): Promise<boolean> {
        // COMBAK: Eventually use the central service's /health endpoint.
        let responseData = ""
        let gotResponse = false
        const httpReqRes = await this.httpClient.get<boolean>("/swagger-ui/index.html")
        if (httpReqRes.isOk()) {
            responseData = JSON.stringify(httpReqRes.value.valueOf()) // ???: What's axios default encoding?
            gotResponse = true
        }
        if (!gotResponse || responseData.length == 0) {
            return false
        }
        return true
    }

    async getSignedCms(request: ISignatureRequest): Promise<Result<ISignatureResponse, Error>> {
        const response = await this.httpClient.post<ISignatureResponse>("/api/v1/signer/issuances", request)
        if (response.isErr()) {
            return err(response.error)
        }
        return ok(response.value)
    }
}

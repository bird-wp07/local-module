import { ok, err, Result } from "neverthrow"
import { CsSignatureResponse, CsSignatureRequest, CsValidationRequest, CsValidationResponse } from "./types"
import { Inject } from "typescript-ioc"
import { IHttpClient } from "../httpClient"
import { ISignatureServiceClient } from "../ISignatureServiceClient"
import { CsClientOptions } from "../clientOptions"
import { ValidateSignedDocumentResponse, ValidateSignedDocumentResult } from "../../server/services"
import { EValidationSteps } from "../../types/common"

export class CsClient implements ISignatureServiceClient {
    public baseUrl: string
    constructor(@Inject options: CsClientOptions, @Inject private httpClient: IHttpClient) {
        this.httpClient.setBaseUrl(options.baseUrl)
        this.baseUrl = options.baseUrl
    }
    /**
     * Returns true iff the CS reponds to requests.
     */
    async isOnline(): Promise<Result<boolean, Error>> {
        // COMBAK: Eventually use the central service's /health endpoint.
        let responseData = ""
        let gotResponse = false
        const httpReqRes = await this.httpClient.get<boolean>("/swagger-ui/index.html")
        if (httpReqRes.isOk()) {
            responseData = JSON.stringify(httpReqRes.value.valueOf()) // ???: What's axios default encoding?
            gotResponse = true
        }
        if (!gotResponse || responseData.length == 0) {
            return ok(false)
        }
        return ok(true)
    }

    async getSignedCms(request: CsSignatureRequest): Promise<Result<CsSignatureResponse, Error>> {
        const response = await this.httpClient.post<CsSignatureResponse>("/api/v1/signer/issuances", request)
        if (response.isErr()) {
            return err(response.error)
        }
        return ok(response.value)
    }

    public async validate(request: CsValidationRequest): Promise<Result<ValidateSignedDocumentResponse, Error>> {
        const verificationQuery = this.buildVerificationQuery(request)
        const validationResponse = await this.httpClient.get<CsValidationResponse>("api/v1/verifier/verifications" + verificationQuery)
        if (validationResponse.isErr()) {
            return err(validationResponse.error)
        }
        const results: ValidateSignedDocumentResult[] = validationResponse.value.results.map((res) => {
            return { validationStep: EValidationSteps.ISSUER, passed: res.passed, reason: res.policyDescription }
        })

        return ok({ results: results })
    }

    private buildVerificationQuery(request: CsValidationRequest): string {
        const queryValues = Object.keys(request).map((key) => {
            return `${key}=${request[key as keyof CsValidationRequest]}`
        })
        return "?" + queryValues.join("&")
    }
}

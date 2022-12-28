import { AxiosRequestConfig } from "axios";
import { ok, err, Result } from "neverthrow"
import { Base64 } from "../src/types/common";
import * as Utility from "../src/utility"

export class centralServiceClient {
    public async getSignedCMS(request: ISignatureRequest): Promise<Result<ISignatureResponse, Error>> {
        const signatureResponse = centralServiceResponseMap.get(request.hash)
        if (signatureResponse == undefined) {
            return err(Error("No reponse is provided by the dummy implementation."))
        }
        return ok(signatureResponse)
    }

    private async getResponseOfActualCentralService(request: ISignatureRequest): Promise<Result<ISignatureResponse, Error>> {
        const config: AxiosRequestConfig = {
            method: "POST",
            url: "/api/v1/signing/issuances",
            baseURL: "https://46.83.201.35.bc.googleusercontent.com",
            data: request
        }
        const response = await Utility.httpReq(config)
        if (response.isErr()) {
            return err(response.error)
        }
        return ok(response.value.data)
    }

}

export interface ISignatureRequest {
    issuerId: String,
    hash: Base64,
    digestMethod: String,
    auditLog: String
}

export interface ISignatureResponse {
        signatureHash: String,
        signature: String,
        cms: String
}

const exampleResponse: ISignatureResponse = {
    "signatureHash": "the hash of the signature",
    "signature": "MEUCIQCnj1AVT1CdpbfZMFtx0yirtZrzFGzbjUBOBgZtN1Y9aAIgZRhX8XP6OQvE1HACzY5/PZzvDvxPrplpd1AfdzKbLZM=",
    "cms": "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"
}

const centralServiceResponseMap = new Map<Base64,ISignatureResponse>([
    ["LKzqH/84VwE6BA10+ynTrB7jjNAliRRo7I2BUCukMXU=", exampleResponse]
])
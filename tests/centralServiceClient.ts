import { ok } from "assert";
import { AxiosRequestConfig } from "axios";
import { err } from "neverthrow";
import { Base64 } from "../src/types/common";
import * as Utility from "../src/utility"

export class centralServiceClient {
    public async getSignedCMS(request: ISignatureRequest) {
        const config: AxiosRequestConfig = {
            method: "POST",
            url: "/v1/signing/issuances",
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

export const exampleSignatureRequest: ISignatureRequest = {
    auditLog: "Signing of Test Document",
    issuerId: "ID-OF-YOUR-KEY",
    hash: "toBeInserted",
    digestMethod: "SHA256"
  }
import { ok, err, Result } from "neverthrow"
import { AxiosError, AxiosRequestConfig } from "axios"
import * as Utility from "../utility"
import { IGetDataToSignRequest, IGetDataToSignResponse, ISignDocumentResponse, IValidateSignatureRequest, IValidateSignatureResponse } from "./types"
import * as Dss from "."

export abstract class IDssClient {
    public abstract isOnline(options?: { waitSeconds?: number }): Promise<boolean>
    public abstract getDataToSign(request: IGetDataToSignRequest): Promise<Result<IGetDataToSignResponse, Error>>
    public abstract signDocument(request: Dss.ISignDocumentRequest): Promise<Result<ISignDocumentResponse, Error>>
    public abstract validateSignature(request: IValidateSignatureRequest): Promise<Result<IValidateSignatureResponse, Error>>
}

// TODO: Validierung für Dss' Reponse einbauen. (Fallnetz für Reverse Engineering)
export class DssClient implements IDssClient {
    baseurl: string
    constructor(baseurl: string) {
        this.baseurl = baseurl
    }

    /**
     * Checks whether the DSS API is accessible at the specified base url by
     * querying the DSS's default browser API.
     *
     * If 'waitSeconds' is set, this request is repeated with brief pauses in
     * between until the set time has passed or a reply is received from the
     * server.
     */
    async isOnline(options?: { waitSeconds?: number }): Promise<boolean> {
        const waitSeconds = options?.waitSeconds ? options.waitSeconds : 0
        const start = new Date().getTime() // returns unix seconds

        let responseData = ""
        let gotResponse = false
        const config: AxiosRequestConfig = {
            baseURL: this.baseurl,
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
            await Utility.sleepms(1000)
        } while ((new Date().getTime() - start) / 1000 < waitSeconds)

        /* Fail if we timed out or if we didn't get the expected response. */
        if (!gotResponse || responseData.length == 0 || !responseData.includes("<title>DSS Demonstration WebApp</title>")) {
            return false
        }
        return true
    }

    public async getDataToSign(request: IGetDataToSignRequest): Promise<Result<IGetDataToSignResponse, Error>> {
        const config: AxiosRequestConfig = {
            method: "POST",
            url: "/services/rest/signature/one-document/getDataToSign",
            baseURL: this.baseurl,
            data: request
        }
        const rsltHttpReq = await Utility.httpReq(config)
        if (rsltHttpReq.isErr()) {
            return err(DssClient.parseError(rsltHttpReq.error))
        }
        return ok(rsltHttpReq.value.data)
    }

    public async signDocument(request: Dss.ISignDocumentRequest): Promise<Result<ISignDocumentResponse, Error>> {
        const config: AxiosRequestConfig = {
            method: "POST",
            url: "/services/rest/signature/one-document/signDocument",
            baseURL: this.baseurl,
            data: request
        }
        const rsltHttpReq = await Utility.httpReq(config)
        if (rsltHttpReq.isErr()) {
            return err(DssClient.parseError(rsltHttpReq.error))
        }
        return ok(rsltHttpReq.value.data)
    }

    public async validateSignature(request: IValidateSignatureRequest): Promise<Result<IValidateSignatureResponse, Error>> {
        const config: AxiosRequestConfig = {
            method: "POST",
            url: "/services/rest/validation/validateSignature",
            baseURL: this.baseurl,
            data: request
        }
        const rsltHttpReq = await Utility.httpReq(config)
        if (rsltHttpReq.isErr()) {
            return err(DssClient.parseError(rsltHttpReq.error))
        }
        return ok(rsltHttpReq.value.data)
    }

    /**
     * Transforms the response produced by invalid or unsuccessful DSS requests
     * into meaningful, typed errors. Paths are implemented as needed.
     */
    static parseError(err: any): Error {
        if (err instanceof AxiosError) {
            if (err.code === AxiosError.ERR_BAD_RESPONSE && typeof err.response?.data === "string") {
                const dssErrorMsg = err.response.data
                if (
                    dssErrorMsg.startsWith("Cannot deserialize value") ||
                    dssErrorMsg.startsWith("Illegal unquoted character") ||
                    dssErrorMsg.startsWith("Unexpected end-of-input")
                ) {
                    return new Dss.DeserializationError()
                }

                if (dssErrorMsg.startsWith("java.io.IOException: Error: End-of-File, expected line")) {
                    return new Dss.UnexpectedInput()
                }

                if (dssErrorMsg.startsWith("The document cannot be modified!")) {
                    return new Dss.DocumentCannotBeModified()
                }

                let match = dssErrorMsg.match(/^The signing certificate \(notBefore : ([^,]+), notAfter : ([^)]+)\) is not yet valid at signing time ([^!]+)!/)
                if (match != null && match.length === 4) {
                    return new Dss.CertificateNotYetValid(`Certificate (valid from '${match[1]}' to '${match[2]}') is not yet valid at signing time '${match[3]}'.`)
                }

                match = dssErrorMsg.match(/^The signing certificate \(notBefore : ([^,]+), notAfter : ([^)]+)\) is expired at signing time ([^!]+)!/)
                if (match != null && match.length === 4) {
                    return new Dss.CertificateExpired(`Certificate (valid from '${match[1]}' to '${match[2]}') is expired at signing time '${match[3]}'.`)
                }
            }
        }
        return new Dss.UnhandledError(err)
    }
}

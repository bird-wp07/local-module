import * as xml2js from "xml2js"
import { ok, err, Result } from "neverthrow"
import { AxiosError, AxiosRequestConfig } from "axios"
import * as Utility from "../utility"
import { IGetDataToSignRequest, IGetDataToSignResponse, ISignDataResponse, IValidateSignatureRequest, IValidateSignatureResponse } from "./types"
import { Base64 } from "./types"
import { ISignDocumentRequest } from "../utility"
import * as Dss from "."

// TODO: makeDssClient()

export class DssClient {
    public baseUrl: string
    constructor(baseUrl: string) {
        this.baseUrl = baseUrl
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
            baseURL: this.baseUrl,
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
            baseURL: this.baseUrl,
            data: request
        }
        const response = await Utility.httpReq(config)
        if (response.isErr()) {
            return err(DssClient.parseError(response.error))
        }
        return ok(response.value.data)
    }

    public async signDocument(request: ISignDocumentRequest): Promise<Result<ISignDataResponse, Error>> {
        const config: AxiosRequestConfig = {
            method: "POST",
            url: "/services/rest/signature/one-document/signDocument",
            baseURL: this.baseUrl,
            data: request
        }
        const response = await Utility.httpReq(config)
        if (response.isErr()) {
            return err(DssClient.parseError(response.error))
        }
        return ok(response.value.data)
    }

    public async validateSignature(request: IValidateSignatureRequest): Promise<Result<IValidateSignatureResponse, Error>> {
        const config: AxiosRequestConfig = {
            method: "POST",
            url: "/services/rest/validation/validateSignature",
            baseURL: this.baseUrl,
            data: request
        }
        const response = await Utility.httpReq(config)
        if (response.isErr()) {
            return err(DssClient.parseError(response.error))
        }
        return ok(response.value.data)
    }

    /**
     * Transforms the response produced by invalid or unsuccessful DSS requests
     * into meaningful, typed errors.
     *
     * Implemented on a need-to-have basis; WIP
     *
     * @param err The error returned by httpReq
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
                    return new Dss.Errors.DeserializationError()
                }

                if (dssErrorMsg.startsWith("java.io.IOException: Error: End-of-File, expected line")) {
                    return new Dss.Errors.UnexpectedInput()
                }

                let match = dssErrorMsg.match(/^The signing certificate \(notBefore : ([^,]+), notAfter : ([^)]+)\) is not yet valid at signing time ([^!]+)!/)
                if (match != null && match.length === 4) {
                    return new Dss.Errors.CertificateNotYetValid(`Certificate (valid from '${match[1]}' to '${match[2]}') is not yet valid at signing time '${match[3]}'.`)
                }

                match = dssErrorMsg.match(/^The signing certificate \(notBefore : ([^,]+), notAfter : ([^)]+)\) is expired at signing time ([^!]+)!/)
                if (match != null && match.length === 4) {
                    return new Dss.Errors.CertificateExpired(`Certificate (valid from '${match[1]}' to '${match[2]}') is expired at signing time '${match[3]}'.`)
                }
            }
        }
        return new Dss.Errors.UnhandledError(err)
    }
}

/**
 * Extracts the base64 encoded digest value from a xmldsig.
 *
 * @param xml - the complete xmldsig XML structure.
 * @returns The base64 encoded signature value.
 *
 * See 'https://www.w3.org/TR/xmldsig-core1/#sec-SignedInfo'.
 */
export async function getDigestValueFromXmldsig(xml: string): Promise<Base64> {
    /* eslint-disable */ // xml2js declarations suck
    const xmlStruct = await xml2js.parseStringPromise(xml)
    const digest64: string = xmlStruct["ds:SignedInfo"]["ds:Reference"].filter((e: any) => e.$.Type === "http://www.w3.org/2000/09/xmldsig#Object")[0]["ds:DigestValue"][0]
    /* eslint-enable */

    return digest64
}

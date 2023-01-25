import { AxiosError } from "axios";
import { err, ok, Result } from "neverthrow";
import { DssClientOptions } from "../ClientOptions";
import { HttpClient, IHttpClient } from "../HttpClient";
import { IDocumentClient } from "../IDocumentClient";
import * as DssErrors from "./DssErrors"
import ASN1 from "@lapo/asn1js";
import * as ASNSchema from "@peculiar/asn1-schema"
import { ESignatureValidationIndication, EEncryptionAlgorithm, ESignatureAlgorithm, IGetDataToSignRequest, IValidateSignatureRequest, IValidateSignatureResponse, IGetDataToSignResponse, convert, ISignDocumentRequest, ISignDocumentResponse, IToSignDocumentParams } from "./types/";
import { Base64, ESignatureLevel } from "../../types/common";
import * as xml2js from "xml2js"
import { GetDataToSignRequest, GetDataToSignResponse, MergeDocumentRequest, MergeDocumentResponse, ValidateSignedDocumentRequest, ValidateSignedDocumentResponse } from "../../server/services";

export class DssClient implements IDocumentClient {
    private httpClient: IHttpClient
    constructor(options: DssClientOptions) {
        this.httpClient = new HttpClient()
        this.httpClient.setBaseUrl(options.baseUrl)
    }
    
    public async isOnline(): Promise<Result<boolean, Error>> {
        let responseData = ""
        let gotResponse = false
        const httpReqRes = await this.httpClient.get<boolean>("")
        if (httpReqRes.isOk()) {
            responseData = JSON.stringify(httpReqRes.value.valueOf()) // ???: What's axios default encoding?
            gotResponse = true
        }
        if (!gotResponse || responseData.length == 0 || !responseData.includes("<title>DSS Demonstration WebApp</title>")) {
            return ok(false)
        }
        return ok(true)
    }

    public async getDataToSign(request: GetDataToSignRequest): Promise<Result<GetDataToSignResponse, Error>> {
        const dssRequest: IGetDataToSignRequest = this.convertDataToSignRequest(request)
        const digestResponse = await this.httpClient.post<IGetDataToSignResponse>("/services/rest/signature/one-document/getDataToSign", dssRequest)
        if (digestResponse.isErr()) {
            return err(this.parseError(digestResponse.error))
        }

        let digest: Base64
        if (request.signatureLevel === ESignatureLevel.PAdES_B) {
            digest = this.extractDigestFromCMS(digestResponse.value.bytes)
        } else {
            digest = digestResponse.value.bytes
        }

        return ok({ digest: digest })
    }

    private extractDigestFromCMS(cms: Base64): Base64 {
        const encodedDigest = ASN1.decode(Buffer.from(cms, "base64"))
        const octetString = encodedDigest.sub![1].sub![1].sub![0]
        const messageDigest = ASNSchema.AsnParser.parse(Buffer.from(octetString.toB64String(), "base64"), ASNSchema.OctetString)
        const documentHash = Buffer.from(new Uint8Array(messageDigest.buffer)).toString("base64")
        return documentHash
    }

    private convertDataToSignRequest(request: GetDataToSignRequest): IGetDataToSignRequest {
        return {
            toSignDocument: {
                bytes: request.bytes
            },
            parameters: {
                digestAlgorithm: request.digestAlgorithm,
                encryptionAlgorithm: EEncryptionAlgorithm.ECDSA,
                signatureLevel: request.signatureLevel,
                generateTBSWithoutCertificate: true,
                signaturePackaging: request.signaturePackaging,
                signatureAlgorithm: ESignatureAlgorithm.ECDSA_SHA256,
                blevelParams: {
                    signingDate: request.signingTimestamp!
                }
            }
        }
    }

    public async mergeDocument(request: MergeDocumentRequest): Promise<Result<MergeDocumentResponse, Error>> {
        if (!request.cms) {
            return err(new DssErrors.PropertyMissing("CMS"))
        }
        if (!request.signingTimestamp) {
            return err(new DssErrors.PropertyMissing("Signing Timestamp"))
        }
        const dssRequest = this.convertMergeRequest(request)
        const signDocumentRes = await this.httpClient.post<ISignDocumentResponse>("/services/rest/signature/one-document/signDocument", dssRequest)
        if (signDocumentRes.isErr()) {
            return err(this.parseError(signDocumentRes.error))
        }
        return ok({ bytes: signDocumentRes.value.bytes })
    }

    private convertMergeRequest(request: MergeDocumentRequest): ISignDocumentRequest {
        const convertedCMS = convert(request.cms!)
        const requestData: ISignDocumentRequest = convertedCMS.dssParams
        requestData.toSignDocument = {
            bytes: request.bytes
        }
        requestData.parameters.blevelParams = {
            signingDate: request.signingTimestamp!
        }
        return requestData
    }

    public async validateSignature(request: ValidateSignedDocumentRequest): Promise<Result<ValidateSignedDocumentResponse, Error>> {
        const dssRequest: IValidateSignatureRequest = {
            signedDocument: {
                bytes: request.signedDocument.bytes,
                name: request.signedDocument.name,
                digestAlgorithm: null
            },
            originalDocuments: request.originalDocuments as IToSignDocumentParams[],
            policy: null,
            signatureId: null
        }
        const response = await this.httpClient.post<IValidateSignatureResponse>("/services/rest/validation/validateSignature", dssRequest)
        if (response.isErr()) {
            return err(this.parseError(response.error))
        }

        let result: ValidateSignedDocumentResponse
        const signatures = response.value.SimpleReport.signatureOrTimestamp

        /* Check for checked signature. If none are returned, we respond with
         * an error, in contrast to DSS. */
        if (signatures == undefined || signatures.length === 0) {
            result = {
                result: ESignatureValidationIndication.TOTAL_FAILED,
                reason: "NO_SIGNATURE"
            }
        } else if (signatures.length === 1) {
            result = {
                result: signatures[0].Signature.Indication,
                reason: signatures[0].Signature.SubIndication
            }
        } else {
            throw new Error("Multiple signatures not yet supported.")
        }

        return ok(result)
    }

    /**
     * Transforms the response produced by invalid or unsuccessful DSS requests
     * into meaningful, typed errors.
     *
     * Implemented on a need-to-have basis; WIP
     *
     * @param err The error returned by httpReq
     */
    private parseError(err: any): Error {
        if (err instanceof AxiosError) {
            if (err.code === AxiosError.ERR_BAD_RESPONSE && typeof err.response?.data === "string") {
                const dssErrorMsg = err.response.data
                if (
                    dssErrorMsg.startsWith("Cannot deserialize value") ||
                    dssErrorMsg.startsWith("Illegal unquoted character") ||
                    dssErrorMsg.startsWith("Unexpected end-of-input")
                ) {
                    return new DssErrors.DeserializationError()
                }

                if (dssErrorMsg.startsWith("java.io.IOException: Error: End-of-File, expected line")) {
                    return new DssErrors.UnexpectedInput()
                }

                let match = dssErrorMsg.match(/^The signing certificate \(notBefore : ([^,]+), notAfter : ([^)]+)\) is not yet valid at signing time ([^!]+)!/)
                if (match != null && match.length === 4) {
                    return new DssErrors.CertificateNotYetValid(`Certificate (valid from '${match[1]}' to '${match[2]}') is not yet valid at signing time '${match[3]}'.`)
                }

                match = dssErrorMsg.match(/^The signing certificate \(notBefore : ([^,]+), notAfter : ([^)]+)\) is expired at signing time ([^!]+)!/)
                if (match != null && match.length === 4) {
                    return new DssErrors.CertificateExpired(`Certificate (valid from '${match[1]}' to '${match[2]}') is expired at signing time '${match[3]}'.`)
                }
            }
        }
        return new DssErrors.UnhandledError(err)
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
import { AxiosError } from "axios"
import { err, ok, Result } from "neverthrow"
import { DssClientOptions } from "../clientOptions"
import { IHttpClient } from "../httpClient"
import { IDocumentClient } from "../IDocumentClient"
import * as DssErrors from "./dssErrors"
import ASN1 from "@lapo/asn1js"
import * as ASNSchema from "@peculiar/asn1-schema"
import {
    ESignatureValidationIndication,
    EEncryptionAlgorithm,
    ESignatureAlgorithm,
    DssGetDataToSignRequest,
    DssValidateSignatureRequest,
    DssValidateSignatureResponse,
    DssGetDataToSignResponse,
    convert,
    DssSignDocumentRequest,
    DssSignDocumentResponse,
    DssToSignDocumentParams,
    DssValidateSignatureValue
} from "./types"
import { Base64, ESignatureLevel, EValidationSteps } from "../../types/common"
import * as xml2js from "xml2js"
import {
    GetDataToSignRequest,
    GetDataToSignResponse,
    GetSignatureValueRequest,
    GetSignatureValueResponse,
    MergeDocumentRequest,
    MergeDocumentResponse,
    ValidateSignedDocumentRequest,
    ValidateSignedDocumentResponse,
    ValidateSignedDocumentResult
} from "../../server/services"
import { Inject } from "typescript-ioc"

export class DssClient extends IDocumentClient {
    constructor(@Inject private httpClient: IHttpClient, @Inject options: DssClientOptions) {
        super()
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
        const dssRequest: DssGetDataToSignRequest = this.convertDataToSignRequest(request)
        const digestResponse = await this.httpClient.post<DssGetDataToSignResponse>("/services/rest/signature/one-document/getDataToSign", dssRequest)
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

    private convertDataToSignRequest(request: GetDataToSignRequest): DssGetDataToSignRequest {
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
        const signDocumentRes = await this.httpClient.post<DssSignDocumentResponse>("/services/rest/signature/one-document/signDocument", dssRequest)
        if (signDocumentRes.isErr()) {
            return err(this.parseError(signDocumentRes.error))
        }
        return ok({ bytes: signDocumentRes.value.bytes })
    }

    private convertMergeRequest(request: MergeDocumentRequest): DssSignDocumentRequest {
        const convertedCMS = convert(request.cms!)
        const requestData: DssSignDocumentRequest = convertedCMS.dssParams
        requestData.toSignDocument = {
            bytes: request.bytes
        }
        requestData.parameters.blevelParams = {
            signingDate: request.signingTimestamp!
        }
        return requestData
    }

    public async validate(request: ValidateSignedDocumentRequest): Promise<Result<ValidateSignedDocumentResponse, Error>> {
        const dssRequest = this.convertValidationRequest(request)
        const response = await this.httpClient.post<DssValidateSignatureResponse>("/services/rest/validation/validateSignature", dssRequest)
        if (response.isErr()) {
            return err(this.parseError(response.error))
        }

        let result: ValidateSignedDocumentResult
        const signatures = response.value.SimpleReport.signatureOrTimestamp

        /* Check for checked signature. If none are returned, we respond with
         * an error, in contrast to DSS. */
        if (signatures == undefined || signatures.length === 0) {
            result = {
                validationStep: EValidationSteps.SIGNATURE,
                passed: false,
                reason: "NO_SIGNATURE"
            }
        } else if (signatures.length === 1) {
            result = {
                validationStep: EValidationSteps.SIGNATURE,
                passed: signatures[0].Signature.Indication === ESignatureValidationIndication.TOTAL_PASSED ? true : false,
                reason: signatures[0].Signature.SubIndication
            }
        } else {
            throw new Error("Multiple signatures not yet supported.")
        }

        return ok({ results: [result] })
    }

    public async getSignatureValue(request: GetSignatureValueRequest): Promise<Result<GetSignatureValueResponse, Error>> {
        const dssRequest = this.convertValidationRequest(request)
        const response = await this.httpClient.post<DssValidateSignatureValue>("/services/rest/validation/validateSignature", dssRequest)
        if (response.isErr()) {
            return err(this.parseError(response.error))
        }

        const signatures = response.value.DiagnosticData.Signature

        if (signatures && signatures.length === 1) {
            const signatureValue: GetSignatureValueResponse = {
                signatureValue: signatures[0].SignatureValue
            }
            return ok(signatureValue)
        } else {
            throw new Error("No or multiple signatures found.")
        }
    }

    private convertValidationRequest(request: ValidateSignedDocumentRequest | GetSignatureValueRequest): DssValidateSignatureRequest {
        const dssRequest: DssValidateSignatureRequest = {
            signedDocument: {
                bytes: request.signedDocument.bytes,
                name: request.signedDocument.name,
                digestAlgorithm: null
            },
            originalDocuments: [] as DssToSignDocumentParams[],
            policy: null,
            signatureId: null
        }
        if ("originalDocuments" in request) {
            dssRequest.originalDocuments = request.originalDocuments as DssToSignDocumentParams[]
        }
        return dssRequest
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

import { Base64 } from "../../types/common"
import { Body, Controller, Post, Route } from "tsoa"
import { DssClient } from "../../dss/dssClient"
import { ESignatureLevel, ESignaturePackaging, IGetDataToSignRequest } from "../../dss/types"
import { IDigestBlobRequest, IDigestBlobResponse, IDigestPDFRequest, IDigestPDFResponse } from "./types"

@Route("digest")
export class DigestController extends Controller {
    dssClient: DssClient

    public constructor(dssBaseUrl?: string) {
        super()

        // TODO: How can the DssClient dependency be systematically resolved?
        dssBaseUrl = process.env.DSS_BASEURL ?? "http://127.0.0.1:8080"
        this.dssClient = new DssClient(dssBaseUrl)
    }

    @Post("blob")
    public async digestBlob(@Body() request: IDigestBlobRequest): Promise<IDigestBlobResponse> {
        // TODO: Validate base64
        const requestData: IGetDataToSignRequest = {
            parameters: {
                signatureLevel: ESignatureLevel.XAdES_B,
                digestAlgorithm: request.digestAlgorithm,
                signaturePackaging: ESignaturePackaging.enveloping,
                generateTBSWithoutCertificate: true
            },
            toSignDocument: {
                bytes: request.bytes
            }
        }
        const getDataToSignRes = await this.dssClient.getDataToSign(requestData)
        if (getDataToSignRes.isErr()) {
            throw getDataToSignRes.error
        }
        const xmldsig = getDataToSignRes.value.bytes
        const digest: Base64 = await DssClient.getDigestValueFromXmldsig(xmldsig)
        const response: IDigestBlobResponse = { bytes: digest }
        return response
    }

    @Post("pdf")
    public async DigestPDF(@Body() request: IDigestPDFRequest): Promise<IDigestPDFResponse> {
        // FIXME: Bogus implementation
        return await this.digestBlob(request)
    }
}

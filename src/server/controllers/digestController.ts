import { Base64 } from "../../types/common"
import { Body, Request, Controller, Post, Route } from "tsoa"
import { DssClient } from "../../dss/dssClient"
import { ESignatureLevel, ESignaturePackaging, IGetDataToSignRequest } from "../../dss/types"
import { IDigestBlobRequest, IDigestBlobResponse, IDigestPDFRequest, IDigestPDFResponse } from "./types"
import { dssClient } from "../../main"

@Route("digest")
export class DigestController extends Controller {
    /**
     * Returns the base64 encoded digest of a base64 encoded sequence of bytes.
     */
    @Post("blob")
    public async digestBlob(@Body() body: IDigestBlobRequest, @Request() request: any): Promise<IDigestBlobResponse> {
        // TODO: Validate base64
        const requestData: IGetDataToSignRequest = {
            parameters: {
                signatureLevel: ESignatureLevel.XAdES_B,
                digestAlgorithm: body.digestAlgorithm,
                signaturePackaging: ESignaturePackaging.enveloping,
                generateTBSWithoutCertificate: true
            },
            toSignDocument: {
                bytes: body.bytes
            }
        }
        const getDataToSignRes = await dssClient.getDataToSign(requestData)
        if (getDataToSignRes.isErr()) {
            throw getDataToSignRes.error
        }
        const xmldsig = getDataToSignRes.value.bytes
        const digest: Base64 = await DssClient.getDigestValueFromXmldsig(xmldsig)
        const response: IDigestBlobResponse = { bytes: digest }
        return response
    }

    // @Post("pdf")
    // public async DigestPDF(@Body() request: IDigestPDFRequest): Promise<IDigestPDFResponse> {
    //     // FIXME: Bogus implementation
    //     return await this.digestBlob(request)
    // }
}

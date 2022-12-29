import { Base64 } from "../../../types/common"
import { Body, Controller, Post, Route } from "tsoa"
import * as Dss from "../../../dss"
import { IDigestBlobRequest, IDigestBlobResponse, IDigestPDFRequest, IDigestPDFResponse } from "../types"
import { dssClient } from "../../../main" // HACK
import { DigestFacade } from "./digestFacade"

@Route("digest")
export class DigestController extends Controller {
    /**
     * Returns the base64 encoded digest of a base64 encoded sequence of bytes.
     */
    @Post("blob")
    public async digestBlob(@Body() body: IDigestBlobRequest): Promise<IDigestBlobResponse> {
        // TODO: Validate base64
        const requestData: Dss.IGetDataToSignRequest = {
            parameters: {
                signatureLevel: Dss.ESignatureLevel.XAdES_B,
                digestAlgorithm: body.digestAlgorithm,
                signaturePackaging: Dss.ESignaturePackaging.enveloping,
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
        const xmldsig = Buffer.from(getDataToSignRes.value.bytes, "base64").toString("utf8")
        const digest: Base64 = await Dss.getDigestValueFromXmldsig(xmldsig)
        const response: IDigestBlobResponse = { digest: digest }
        return response
    }

    @Post("pdf")
    public async DigestPDF(@Body() request: IDigestPDFRequest): Promise<IDigestPDFResponse> {
        return await new DigestFacade(dssClient).digestPDF(request)
    }
}

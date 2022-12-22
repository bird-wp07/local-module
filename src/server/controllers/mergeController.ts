import { Base64 } from "../../types/common"
import { Body, Controller, Post, Route } from "tsoa"
import * as Dss from "../../dss"
import { IDigestBlobRequest, IDigestBlobResponse, IDigestPDFRequest, IDigestPDFResponse, IMergePDFRequest, IMergePDFResponse } from "./types"
import { dssClient } from "../../main" // HACK
import { CMS2DSS, DSSParams } from "../../utility"

@Route("merge")
export class MergeController extends Controller {

    private async mergePDF(body:IMergePDFRequest):Promise<IMergePDFResponse> {
        const convertedCMS = CMS2DSS.convert(body.signatureAsCMS)
        const requestData: DSSParams = convertedCMS.dssParams
        requestData.toSignDocument = {
            bytes: body.bytes
        }
        requestData.parameters.blevelParams = {
            signingDate: body.timestamp
        }
        const signDataRes = await dssClient.signData(requestData)
        if (signDataRes.isErr()) {
            throw signDataRes.error
        }
        const response: IDigestBlobResponse = { bytes: signDataRes.value.bytes }
        return response
    }

    @Post("pdf")
    public async MergePDF(@Body() request: IMergePDFRequest): Promise<IMergePDFResponse> {
        // FIXME: Bogus implementation
        return await this.mergePDF(request)
    }
}

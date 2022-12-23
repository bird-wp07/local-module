import { DssClient } from "../../../dss"
import { CMS2DSS, DSSParams } from "src/utility"
import { IDigestBlobResponse, IMergePDFRequest, IMergePDFResponse } from "../types"

export class MergeFacade {
    private dssClient: DssClient
    constructor(dssClient: DssClient) {
        this.dssClient = dssClient
    }

    public async mergePDF(body:IMergePDFRequest):Promise<IMergePDFResponse> {
        const convertedCMS = CMS2DSS.convert(body.signatureAsCMS)
        const requestData: DSSParams = convertedCMS.dssParams
        requestData.toSignDocument = {
            bytes: body.bytes
        }
        requestData.parameters.blevelParams = {
            signingDate: body.timestamp
        }
        const signDataRes = await this.dssClient.signData(requestData)
        if (signDataRes.isErr()) {
            throw signDataRes.error
        }
        const response: IDigestBlobResponse = { bytes: signDataRes.value.bytes }
        return response
    }
}
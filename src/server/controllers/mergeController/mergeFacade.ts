import { DssClient } from "../../../dss"
import { CMS2DSS, DSSParams } from "../../../utility"
import { IMergePDFRequest, IMergePDFResponse } from "../types"

export class MergeFacade {
    private dssClient: DssClient
    constructor(dssClient: DssClient) {
        this.dssClient = dssClient
    }

    public async mergePDF(body: IMergePDFRequest): Promise<IMergePDFResponse> {
        const convertedCMS = CMS2DSS.convert(body.signatureAsCMS)
        const requestData: DSSParams = convertedCMS.dssParams
        requestData.toSignDocument = {
            bytes: body.base64
        }
        requestData.parameters.blevelParams = {
            signingDate: body.signingTimestamp
        }
        const signDataRes = await this.dssClient.signData(requestData)
        if (signDataRes.isErr()) {
            throw signDataRes.error
        }
        const response: IMergePDFResponse = { base64: signDataRes.value.bytes }
        return response
    }
}

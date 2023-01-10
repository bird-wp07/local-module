import { ok, err, Result } from "neverthrow"
import { DssClient } from "../../../dss"
import { convert, ISignDocumentRequest } from "../../../utility"
import { IMergePDFRequest, IMergePDFResponse } from "../types"

export class MergeFacade {
    private dssClient: DssClient
    constructor(dssClient: DssClient) {
        this.dssClient = dssClient
    }

    public async mergePDF(body: IMergePDFRequest): Promise<Result<IMergePDFResponse, Error>> {
        const convertedCMS = convert(body.signatureAsCMS)
        const requestData: ISignDocumentRequest = convertedCMS.dssParams
        requestData.toSignDocument = {
            bytes: body.bytes
        }
        requestData.parameters.blevelParams = {
            signingDate: body.signingTimestamp
        }
        const signDocumentRes = await this.dssClient.signDocument(requestData)
        if (signDocumentRes.isErr()) {
            return err(signDocumentRes.error)
        }
        const result: IMergePDFResponse = { bytes: signDocumentRes.value.bytes }
        return ok(result)
    }
}

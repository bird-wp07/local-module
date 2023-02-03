import { ok, err, Result } from "neverthrow"
import { DssClient } from "../../../dss"
import { IMergePDFRequest, IMergePDFResponse } from "../types"
import * as Dss from "../../../dss"

export class MergeFacade {
    private dssClient: DssClient
    constructor(dssClient: DssClient) {
        this.dssClient = dssClient
    }

    public async mergePDF(body: IMergePDFRequest): Promise<Result<IMergePDFResponse, Error>> {
        const cms = Dss.Utils.parseCms(Buffer.from(body.signatureAsCMS, "base64"))
        const signDocumentReq: Dss.ISignDocumentRequest = {
            parameters: {
                certificateChain: cms.certificateChain,
                digestAlgorithm: cms.digestAlgorithm,
                signatureAlgorithm: cms.signatureAlgorithm,
                signingCertificate: cms.signingCertificate,
                signaturePackaging: Dss.ESignaturePackaging.ENVELOPED,
                signWithExpiredCertificate: false,
                generateTBSWithoutCertificate: false,
                signatureLevel: Dss.ESignatureLevel.PAdES_B,
                blevelParams: {
                    signingDate: body.signingTimestamp
                }
            },
            signatureValue: {
                algorithm: cms.signatureAlgorithm,
                value: cms.signatureValue
            },
            toSignDocument: {
                bytes: body.bytes
            }
        }
        const signDocumentRes = await this.dssClient.signDocument(signDocumentReq)
        if (signDocumentRes.isErr()) {
            return err(signDocumentRes.error)
        }

        const result: IMergePDFResponse = { bytes: signDocumentRes.value.bytes }
        return ok(result)
    }
}

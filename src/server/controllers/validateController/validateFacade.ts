import { DssClient, ESignatureValidationIndication, IValidateSignatureRequest } from "../../../dss"
import { IValidateSignedPdfRequest, IValidateSignedPdfResponse } from "../types"

export class ValidateFacade {
    private dssClient: DssClient
    constructor(dssClient: DssClient) {
        this.dssClient = dssClient
    }

    public async validateSignature(request: IValidateSignedPdfRequest): Promise<IValidateSignedPdfResponse> {
    const dssRequest: IValidateSignatureRequest = {
        signedDocument: {
            bytes: request.bytes,
            digestAlgorithm: null
        },
        originalDocuments: [],
        policy: null,
        signatureId: null
    }
    const response = await this.dssClient.validateSignature(dssRequest)
    if (response.isErr()) {
        throw response.error
    }

    let result: IValidateSignedPdfResponse
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

    return result
    }
}
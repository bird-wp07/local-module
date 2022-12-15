import { Example, Body, Controller, Post, Route } from "tsoa"
import * as Dss from "../../../dss"
import { dssClient } from "../../../main" // HACK
import { IValidateSignedPdfRequest, IValidateSignedPdfResponse } from "./types"

@Route("validate")
export class ValidateController extends Controller {
    /**
     * Validates a signed PDF document.
     *
     * NOTE: The example decorators refer to responses, not requests. tsoa is
     *       unable to generate pairs of response and request examples. See
     *
     *           https://github.com/lukeautry/tsoa/issues/1107
     */
    @Post("pdf")
    @Example<IValidateSignedPdfResponse>({
        result: Dss.ESignatureValidationIndication.TOTAL_PASSED,
        reason: null
    })
    @Example<IValidateSignedPdfResponse>({
        result: Dss.ESignatureValidationIndication.INDETERMINATE,
        reason: Dss.ESignatureValidationSubIndication.NO_CERTIFICATE_CHAIN_FOUND
    })
    @Example<IValidateSignedPdfResponse>({
        result: Dss.ESignatureValidationIndication.TOTAL_FAILED,
        reason: Dss.ESignatureValidationSubIndication.HASH_FAILURE
    })
    public async validateSignedPdf(@Body() body: IValidateSignedPdfRequest): Promise<IValidateSignedPdfResponse> {
        const request: Dss.IValidateSignatureRequest = {
            signedDocument: {
                bytes: body.bytes,
                digestAlgorithm: null
            },
            originalDocuments: [],
            policy: null,
            signatureId: null
        }
        const response = await dssClient.validateSignature(request)
        if (response.isErr()) {
            throw response.error
        }

        let result: IValidateSignedPdfResponse
        const signatures = response.value.SimpleReport.signatureOrTimestamp

        /* Check for checked signature. If none are returned, we respond with
         * an error, in contrast to DSS. */
        if (signatures == undefined || signatures.length === 0) {
            result = {
                result: Dss.ESignatureValidationIndication.TOTAL_FAILED,
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

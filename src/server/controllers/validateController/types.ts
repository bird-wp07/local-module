import * as Dss from "../../../dss"
import { Base64 } from "../types"

export interface IValidateSignedPdfResponse {
    result: Dss.ESignatureValidationIndication
    reason: Dss.ESignatureValidationSubIndication | "NO_SIGNATURE" | null
}

export interface IValidateSignedPdfRequest {
    bytes: Base64
}

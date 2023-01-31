import { Result } from "neverthrow"
import { ValidateSignedDocumentRequest, ValidateSignedDocumentResponse } from "../server/services"

export abstract class IVerificationClient {
    public abstract isOnline(): Promise<boolean>
    public abstract validationSignature(request: ValidateSignedDocumentRequest): Promise<Result<ValidateSignedDocumentResponse, Error>>
}

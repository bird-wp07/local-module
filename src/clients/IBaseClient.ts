import { Result } from "neverthrow"
import { ValidateSignedDocumentResponse } from "../server/services"

export abstract class IBaseClient {
    public abstract isOnline(): Promise<Result<boolean, Error>>
    public abstract validate(request: unknown): Promise<Result<ValidateSignedDocumentResponse, Error>>
}

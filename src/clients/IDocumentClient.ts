import { Result } from "neverthrow"
import {
    GetDataToSignResponse,
    GetDataToSignRequest,
    MergeDocumentRequest,
    MergeDocumentResponse,
    ValidateSignedDocumentRequest,
    ValidateSignedDocumentResponse
} from "../server/services"

export abstract class IDocumentClient {
    public abstract getDataToSign(request: GetDataToSignRequest): Promise<Result<GetDataToSignResponse, Error>>
    public abstract mergeDocument(request: MergeDocumentRequest): Promise<Result<MergeDocumentResponse, Error>>
    public abstract validateSignature(request: ValidateSignedDocumentRequest): Promise<Result<ValidateSignedDocumentResponse, Error>>
    public abstract isOnline(): Promise<Result<boolean, Error>>
}

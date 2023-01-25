import { Result } from "neverthrow";
import { GetDataToSignResponse, GetDataToSignRequest, MergeDocumentRequest, MergeDocumentResponse, ValidateSignedDocumentRequest, ValidateSignedDocumentResponse } from "../server/services";

export interface IDocumentClient {
    getDataToSign(request: GetDataToSignRequest): Promise<Result<GetDataToSignResponse, Error>>;
    mergeDocument(request: MergeDocumentRequest): Promise<Result<MergeDocumentResponse, Error>>;
    validateSignature(request: ValidateSignedDocumentRequest): Promise<Result<ValidateSignedDocumentResponse, Error>>;
    isOnline(): Promise<Result<boolean, Error>>
}
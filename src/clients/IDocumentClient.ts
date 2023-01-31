import { Result } from "neverthrow"
import { GetDataToSignResponse, GetDataToSignRequest, MergeDocumentRequest, MergeDocumentResponse, GetSignatureValueRequest, GetSignatureValueResponse } from "../server/services"
import { IBaseClient } from "./IBaseClient"

export abstract class IDocumentClient extends IBaseClient {
    public abstract getDataToSign(request: GetDataToSignRequest): Promise<Result<GetDataToSignResponse, Error>>
    public abstract mergeDocument(request: MergeDocumentRequest): Promise<Result<MergeDocumentResponse, Error>>
    public abstract getSignatureValue(request: GetSignatureValueRequest): Promise<Result<GetSignatureValueResponse, Error>>
}

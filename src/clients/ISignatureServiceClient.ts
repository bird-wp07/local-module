import { Result } from "neverthrow"
import { CsSignatureRequest, CsSignatureResponse } from "./cs"
import { IBaseClient } from "./IBaseClient"

export abstract class ISignatureServiceClient extends IBaseClient {
    public abstract getSignedCms(request: CsSignatureRequest): Promise<Result<CsSignatureResponse, Error>>
}

import { Result } from "neverthrow"
import { ISignatureRequest, ISignatureResponse } from "./cs"

export abstract class ISignatureServiceClient {
    public abstract isOnline(): Promise<boolean>
    public abstract getSignedCms(request: ISignatureRequest): Promise<Result<ISignatureResponse, Error>>
}

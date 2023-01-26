import { Result } from "neverthrow"
import { SignatureRequest, SignatureResponse } from "./cs"

export abstract class ISignatureServiceClient {
    public abstract isOnline(): Promise<boolean>
    public abstract getSignedCms(request: SignatureRequest): Promise<Result<SignatureResponse, Error>>
}

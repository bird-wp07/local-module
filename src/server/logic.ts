import { Result, ok, err } from "neverthrow"
import { UnixTimeMs, EDigestAlgorithm, IDigestPDFRequest, IDigestPDFResponse } from "./types"
import * as TsIoc from "typescript-ioc"
import * as Dss from "../dss"

export class Logic {
    constructor(@TsIoc.Inject private dssClient: Dss.IDssClient) {
        this.dssClient = dssClient
    }

    public async health(): Promise<boolean> {
        return await this.dssClient.isOnline()
    }

    public async digestPdf(request: IDigestPDFRequest): Promise<Result<IDigestPDFResponse, Error>> {
        const getDataToSignRequest: Dss.IGetDataToSignRequest = {
            toSignDocument: {
                bytes: request.bytes
            },
            parameters: {
                digestAlgorithm: Logic.digestAlgorithmToDss(request.digestAlgorithm),
                signatureLevel: Dss.ESignatureLevel.PAdES_B,
                generateTBSWithoutCertificate: true,
                blevelParams: {
                    signingDate: request.signingTimestamp ?? 0 // TODO: Why is signingDate optional?
                }
            }
        }
        const response = await this.dssClient.getDataToSign(getDataToSignRequest)
        if (response.isErr()) {
            return err(response.error)
        }
        return ok({ bytes: response.value.bytes })
    }

    static digestAlgorithmToDss(alg: EDigestAlgorithm): Dss.EDigestAlgorithm {
        switch (alg) {
            case EDigestAlgorithm.SHA256:
                return Dss.EDigestAlgorithm.SHA256
            case EDigestAlgorithm.SHA512:
                return Dss.EDigestAlgorithm.SHA512
            default:
                throw new Error("missing implementation")
        }
    }
}

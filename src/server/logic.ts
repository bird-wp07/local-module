import { Result, ok, err } from "neverthrow"
import { EDigestAlgorithm, IDigestPdfRequest, IDigestPDFResponse, IValidateSignedPdfRequest, IValidateSignedPdfResponse } from "./types"
import * as Ioc from "typescript-ioc"
import * as Dss from "../dss"

// TODO: request Object in einzelne pargs aufbrechen für Lesbarkeit
export class Logic {
    constructor(@Ioc.Inject private dssClient: Dss.IDssClient) {
        this.dssClient = dssClient
    }

    public async health(): Promise<boolean> {
        return await this.dssClient.isOnline()
    }

    public async digestPdf(request: IDigestPdfRequest): Promise<Result<IDigestPDFResponse, Error>> {
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

    public async validateSignedPdf(request: IValidateSignedPdfRequest): Promise<Result<IValidateSignedPdfResponse, Error>> {
        /* Perform validation by DSS */
        const validateSignatureRequest: Dss.IValidateSignatureRequest = {
            signedDocument: {
                bytes: request.bytes,
                digestAlgorithm: null
            },
            originalDocuments: [],
            policy: null,
            signatureId: null
        }
        const validateSignatureResponse = await this.dssClient.validateSignature(validateSignatureRequest)
        if (validateSignatureResponse.isErr()) {
            return err(validateSignatureResponse.error)
        }

        /* Check for checked signature. If none are returned, we respond with
         * an error, in contrast to DSS. */
        const signatures = validateSignatureResponse.value.SimpleReport.signatureOrTimestamp
        const numSignatures = signatures == undefined ? 0 : signatures.length
        if (signatures == undefined || signatures.length !== 1) {
            return ok({
                valid: false,
                details: `document must contain exactly one signature, found ${numSignatures}`
            })
        }
        if (signatures[0].Signature.Indication !== Dss.ESignatureValidationIndication.TOTAL_PASSED) {
            return ok({
                valid: false,
                details: signatures[0].Signature.SubIndication
            })
        }
        return ok({
            valid: true,
            details: {}
        })
    }

    // TODOC;
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

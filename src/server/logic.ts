import { Result, ok, err } from "neverthrow"
import { EDigestAlgorithm, IDigestPdfRequest, IDigestPdfResponse, IMergePdfRequest, IMergePdfResponse, IValidateSignedPdfRequest, IValidateSignedPdfResponse } from "./types"
import * as Ioc from "typescript-ioc"
import * as Dss from "../dss"

export abstract class IImpl {
    public abstract health(): Promise<boolean>
    public abstract digestPdf(request: IDigestPdfRequest): Promise<Result<IDigestPdfResponse, Error>>
    public abstract mergePdf(request: IMergePdfRequest): Promise<Result<IMergePdfResponse, Error>>
    public abstract validateSignedPdf(request: IValidateSignedPdfRequest): Promise<Result<IValidateSignedPdfResponse, Error>>
}

// Logic ein aufrufbares Singleton machen, damit nicht instanziiert werden muss.
// TODO: request Object in einzelne pargs aufbrechen für Lesbarkeit
export class Impl implements IImpl {
    constructor(@Ioc.Inject private dssClient: Dss.IDssClient) {
        this.dssClient = dssClient
    }

    public async health(): Promise<boolean> {
        return await this.dssClient.isOnline()
    }

    public async digestPdf(request: IDigestPdfRequest): Promise<Result<IDigestPdfResponse, Error>> {
        const getDataToSignRequest: Dss.IGetDataToSignRequest = {
            toSignDocument: {
                bytes: request.bytes
            },
            parameters: {
                digestAlgorithm: Impl.digestAlgorithmToDss(request.digestAlgorithm),
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

    public async mergePdf(request: IMergePdfRequest): Promise<Result<IMergePdfResponse, Error>> {
        const cms = Dss.Utils.parseCms(Buffer.from(request.signatureAsCMS, "base64"))
        const signDocumentReq: Dss.ISignDocumentRequest = {
            parameters: {
                certificateChain: cms.certificateChain,
                digestAlgorithm: cms.digestAlgorithm,
                signatureAlgorithm: cms.signatureAlgorithm,
                signingCertificate: cms.signingCertificate,
                signaturePackaging: Dss.ESignaturePackaging.ENVELOPED,
                signWithExpiredCertificate: false,
                generateTBSWithoutCertificate: false,
                signatureLevel: Dss.ESignatureLevel.PAdES_B,
                blevelParams: {
                    signingDate: request.signingTimestamp
                }
            },
            signatureValue: {
                algorithm: cms.signatureAlgorithm,
                value: cms.signatureValue
            },
            toSignDocument: {
                bytes: request.bytes
            }
        }
        const signDocumentRes = await this.dssClient.signDocument(signDocumentReq)
        if (signDocumentRes.isErr()) {
            return err(signDocumentRes.error)
        }

        const result: IMergePdfResponse = { bytes: signDocumentRes.value.bytes }
        return ok(result)
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

        /* Check for signatures. If none are returned, we respond with
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

        // TODO: Implement validation of aspects relating to the central service.
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

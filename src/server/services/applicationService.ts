import { err, ok, Result } from "neverthrow"
import { ESignatureLevel, ESignaturePackaging } from "../../types/common"
import { IDocumentClient } from "../../clients"
import {
    DigestPDFRequest,
    DigestPDFResponse,
    EValidateSignedPdfResult,
    MergePDFRequest,
    MergePDFResponse,
    ValidateSignedPdfRequest,
    ValidateSignedPdfResponse
} from "../controllers/types"
import { GetDataToSignRequest, MergeDocumentRequest, ValidateSignedDocumentRequest } from "./types"
import { Inject, Singleton } from "typescript-ioc"
import { ISignatureServiceClient } from "../../clients"

@Singleton
export class ApplicationService {
    constructor(@Inject private documentClient: IDocumentClient, @Inject private signatureClient: ISignatureServiceClient) {}

    // TODO: add validation
    public async createDigestForPDF(request: DigestPDFRequest): Promise<Result<DigestPDFResponse, Error>> {
        const documentRequest: GetDataToSignRequest = this.convertDigestPDFRequest(request)
        return await this.documentClient.getDataToSign(documentRequest)
    }

    public async mergePDF(request: MergePDFRequest): Promise<Result<MergePDFResponse, Error>> {
        const documentMergeRequest: MergeDocumentRequest = this.convertMergePDFRequest(request)
        return await this.documentClient.mergeDocument(documentMergeRequest)
    }

    public async validatePDFSignature(request: ValidateSignedPdfRequest): Promise<Result<ValidateSignedPdfResponse, Error>> {
        const documentValidationRequest: ValidateSignedDocumentRequest = {
            signedDocument: {
                bytes: request.bytes
            }
        }
        const validateDocumentResult = await this.documentClient.validate(documentValidationRequest)
        if (validateDocumentResult.isErr()) {
            return err(validateDocumentResult.error)
        }

        // TODO: currently we get the signature hash by getting the signatureValue from dss, hash it with crypto with sha 256 and base64 encode it
        // Using this hash, the central service returns an error
        // How to get working examples? Response from Felix:
        // Wenn Du Einen Signing-Request absendest, bekommst du einen ETag-Header mit zu deiner Antwort
        // (Das nutzen wir momentan für unsere Tests, ist also ein undokumentiertes Magic-Feature für den nichtproduktiven Gebrauch, aber sollte erstmal eine gute Hilfestellung sein).
        // Das ist der Base64-kodierte Signature-Hash, den du direkt verwenden kannst für die Validation.
        //
        // const signatureValue = await this.documentClient.getSignatureValue(documentValidationRequest)
        // if (signatureValue.isErr()) {
        //     return err(signatureValue.error)
        // }

        // const signatureHash = crypto.createHash("sha256").update(signatureValue.value.signatureValue).digest("base64")
        // const validateIssuerRequest: CsValidationRequest = {
        //     hash: signatureHash,
        //     hashType: EHashType.SIGNATURE_HASH
        // }

        // const validateIssuerResult = await this.signatureClient.validate(validateIssuerRequest)
        // if (validateIssuerResult.isErr()) {
        //     return err(validateIssuerResult.error)
        // }

        // const overallResults = [...validateDocumentResult.value.results, ...validateIssuerResult.value.results]
        const overallResults = validateDocumentResult.value.results

        const overallValidation = overallResults.every((res) => res.passed) ? EValidateSignedPdfResult.TOTAL_PASSED : EValidateSignedPdfResult.TOTAL_FAILED
        const response: ValidateSignedPdfResponse = {
            result: overallValidation,
            reasons: overallResults
        }
        return ok(response)
    }

    private convertDigestPDFRequest(request: DigestPDFRequest): GetDataToSignRequest {
        return {
            digestAlgorithm: request.digestAlgorithm,
            signatureLevel: ESignatureLevel.PAdES_B,
            signaturePackaging: ESignaturePackaging.ENVELOPED,
            signingTimestamp: request.signingTimestamp,
            bytes: request.bytes
        }
    }

    private convertMergePDFRequest(request: MergePDFRequest): MergeDocumentRequest {
        return {
            signingTimestamp: request.signingTimestamp,
            cms: request.signatureAsCMS,
            bytes: request.bytes
        }
    }
}

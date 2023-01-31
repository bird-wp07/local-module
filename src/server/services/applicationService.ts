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
    ValidateSignedPdfResponse,
    ValidateSignedPdfResult
} from "../controllers/types"
import { GetDataToSignRequest, MergeDocumentRequest, ValidateSignedDocumentRequest } from "./types"
import { Inject, Singleton } from "typescript-ioc"
import { ISignatureServiceClient } from "../../clients"
import { CsValidationRequest, EHashType } from "../../clients/cs"
import * as crypto from "crypto"

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

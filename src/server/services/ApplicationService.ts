import { Result } from "neverthrow"
import { ESignatureLevel, ESignaturePackaging } from "../../types/common"
import { IDocumentClient } from "../../clients"
import { DigestPDFRequest, DigestPDFResponse, MergePDFRequest, MergePDFResponse, ValidateSignedPdfRequest, ValidateSignedPdfResponse } from "../controllers/types"
import { GetDataToSignRequest, MergeDocumentRequest, ValidateSignedDocumentRequest } from "./types"
import { Inject, Singleton } from "typescript-ioc"

@Singleton
export class ApplicationService {
    constructor(@Inject public documentClient: IDocumentClient) {}

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
        return await this.documentClient.validateSignature(documentValidationRequest)
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

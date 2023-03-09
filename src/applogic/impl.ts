import * as Pdf from "pdf-lib"
import * as ASN1 from "@lapo/asn1js"
import * as ASNSchema from "@peculiar/asn1-schema"
import { Result, ok, err } from "neverthrow"
import * as Ioc from "typescript-ioc"
import * as Dss from "../dss"
import * as Cs from "../cs"
import * as Utility from "../utility"
import {
    EDocumentValidity,
    EIssuanceValidity,
    IAppLogic,
    IHealthStatus,
    IValidationResult,
    IRevocationResponse,
    ERevocationStatus,
    IIssueSignatureResponse,
    IExtractAttachmentsResult,
    ERevocationReason
} from "./base"
import { Base64 } from "../utility"

/**
 * Implements application logic via DSS and CS API calls.
 */
export class AppLogic implements IAppLogic {
    private dssClient
    private csClient
    constructor(@Ioc.Inject dssClient: Dss.IDssClient, @Ioc.Inject csClient: Cs.ICsClient) {
        this.dssClient = dssClient
        this.csClient = csClient
    }

    /**
     * Returns system health status depending on whether DSS and the CS are
     * online.
     */
    public async health(): Promise<Result<IHealthStatus, Error>> {
        const details: string[] = []
        if (!(await this.dssClient.isOnline())) {
            details.push("can't reach DSS")
        }
        if (!(await this.csClient.isOnline())) {
            details.push("can't reach CS")
        }
        if (details.length !== 0) {
            return ok({
                ok: false,
                details: details
            })
        }
        return ok({ ok: true })
    }

    public async generatePdfDigestToBeSigned(pdf: Base64, timestamp: Date): Promise<Result<Base64, Error>> {
        const getDataToSignRequest: Dss.IGetDataToSignRequest = {
            toSignDocument: {
                bytes: pdf
            },
            parameters: {
                digestAlgorithm: Dss.EDigestAlgorithm.SHA256,
                encryptionAlgorithm: Dss.EEncryptionAlgorithm.ECDSA,
                signatureLevel: Dss.ESignatureLevel.PAdES_B,
                generateTBSWithoutCertificate: true,
                signaturePackaging: Dss.ESignaturePackaging.ENVELOPED,
                signatureAlgorithm: Dss.ESignatureAlgorithm.ECDSA_SHA256,
                blevelParams: {
                    signingDate: Number(timestamp)
                }
            }
        }
        const rsltGetDataToSign = await this.dssClient.getDataToSign(getDataToSignRequest)
        if (rsltGetDataToSign.isErr()) {
            return err(rsltGetDataToSign.error)
        }

        // ???: Which data structure does DSS#getDataToSign() return here?
        //      See question below.
        const asn1blob = Buffer.from(rsltGetDataToSign.value.bytes, "base64")
        const digest = AppLogic.extractDigestFromDigestPdfResponse(asn1blob)
        return ok(digest)
    }

    public async issueSignature(digestToBeSigned: Base64, issuerId: string, auditLog?: string): Promise<Result<IIssueSignatureResponse, Error>> {
        const digestMethod = Cs.EDigestAlgorithm.SHA256
        const rsltIssueSignature = await this.csClient.issueSignature(digestToBeSigned, digestMethod, issuerId, auditLog)
        if (rsltIssueSignature.isErr()) {
            return err(rsltIssueSignature.error)
        }
        const cms: Base64 = rsltIssueSignature.value.cms
        const signatureValueDigest: Base64 = rsltIssueSignature.value.hashes[0].hash
        return ok({ cms: cms, signatureValueDigest: signatureValueDigest })
    }

    public async revokeSignature(signatureValueDigest: Base64, reason: ERevocationReason, auditLog?: string): Promise<Result<IRevocationResponse, Error>> {
        const rsltRevokeSignature = await this.csClient.revokeIssuance(signatureValueDigest, reason, auditLog)
        if (rsltRevokeSignature.isErr()) {
            return err(rsltRevokeSignature.error)
        }
        const revocationResult: Cs.IRevokeIssuanceResponse = rsltRevokeSignature.value

        let status: ERevocationStatus
        switch (revocationResult.status) {
            case Cs.EIssuanceRevocationStatus.ISSUANCE_REVOKED:
                status = ERevocationStatus.ISSUANCE_REVOKED
                break
            case Cs.EIssuanceRevocationStatus.ISSUANCE_NOT_FOUND:
                status = ERevocationStatus.ISSUANCE_NOT_FOUND
                break
            case Cs.EIssuanceRevocationStatus.ISSUANCE_ALREADY_REVOKED:
                status = ERevocationStatus.ISSUANCE_ALREADY_REVOKED
                break
        }
        return ok({ status: status, revocationDate: revocationResult.revocationDate })
    }

    public async embedSignatureIntoPdf(pdf: Base64, timestamp: Date, cms: Base64): Promise<Result<Base64, Error>> {
        const cmsStruct = Dss.Utils.parseCms(Buffer.from(cms, "base64"))
        const signDocumentReq: Dss.ISignDocumentRequest = {
            parameters: {
                certificateChain: cmsStruct.certificateChain,
                digestAlgorithm: cmsStruct.digestAlgorithm,
                signatureAlgorithm: cmsStruct.signatureAlgorithm,
                signingCertificate: cmsStruct.signingCertificate,
                signaturePackaging: Dss.ESignaturePackaging.ENVELOPED,
                signWithExpiredCertificate: false,
                generateTBSWithoutCertificate: false,
                signatureLevel: Dss.ESignatureLevel.PAdES_B,
                blevelParams: {
                    signingDate: Number(timestamp)
                }
            },
            signatureValue: {
                algorithm: cmsStruct.signatureAlgorithm,
                value: cmsStruct.signatureValue
            },
            toSignDocument: {
                bytes: pdf
            }
        }
        const rsltSignDocument = await this.dssClient.signDocument(signDocumentReq)
        if (rsltSignDocument.isErr()) {
            return err(rsltSignDocument.error)
        }
        return ok(rsltSignDocument.value.bytes)
    }

    public async validateSignedPdf(pdf: Base64): Promise<Result<IValidationResult, Error>> {
        const validationResult: IValidationResult = {
            valid: true,
            document: {
                status: EDocumentValidity.DOCUMENT_OK
            },
            issuance: {
                status: EIssuanceValidity.ISSUANCE_OK
            }
        }

        /*
         * 1. Check PAdES conformance of signed PDF using DSS.
         *
         * Retrieve validation result for signed document from DSS. */
        const validateSignatureRequest: Dss.IValidateSignatureRequest = {
            signedDocument: {
                bytes: pdf,
                digestAlgorithm: null
            },
            originalDocuments: [],
            policy: null,
            signatureId: null
        }
        const rsltValidateSignature = await this.dssClient.validateSignature(validateSignatureRequest)
        if (rsltValidateSignature.isErr()) {
            return err(rsltValidateSignature.error)
        }
        const dssValidateSignatureResult = rsltValidateSignature.value

        /* Assert that the document has exactly one signature. */
        const signatures = dssValidateSignatureResult.SimpleReport.signatureOrTimestamp
        const numSignatures = signatures == undefined ? 0 : signatures.length
        if (numSignatures !== 1) {
            validationResult.valid = false
            if (numSignatures === 0) {
                validationResult.document.status = EDocumentValidity.ERROR_DOCUMENT_INVALID
                validationResult.document.details = "no signature found"
            } else {
                validationResult.document.status = EDocumentValidity.ERROR_DOCUMENT_INVALID
                validationResult.document.details = "multiple signatures found"
            }
        } else if (signatures![0].Signature.Indication !== Dss.ESignatureValidationIndication.TOTAL_PASSED) {
            validationResult.valid = false
            validationResult.document.status = EDocumentValidity.ERROR_DOCUMENT_UNTRUSTED
            validationResult.document.details = dssValidateSignatureResult
        }

        /* If the document content (TODO: reword; too vague) itself is invalid
         * we skip the validation of the signature issuance and return
         * immediately. In case of an unsigned or multi-signature document
         * there is no issuance to check in the first place. */
        if (validationResult.document.status === EDocumentValidity.ERROR_DOCUMENT_INVALID) {
            validationResult.issuance.status = EIssuanceValidity.ERROR_DOCUMENT_INVALID
            return ok(validationResult)
        }

        /*
         * 2. Validate issuance via CS.
         *
         * Retrieve base64 encoded signature value from the DSS' validation
         * report, convert to binary, compute its SHA256 digest and encode as base64. */
        const signatureValue: Base64 = dssValidateSignatureResult.DiagnosticData.Signature[0].SignatureValue
        const signatureValueDigest: Base64 = Utility.sha256sum(Buffer.from(signatureValue, "base64")).toString("base64")

        /* Retrieve issuance validation result from CS. */
        const rsltValidateIssuance = await this.csClient.validateIssuance(signatureValueDigest)
        if (rsltValidateIssuance.isErr()) {
            return err(rsltValidateIssuance.error)
        }
        const csValidateIssuanceResult = rsltValidateIssuance.value
        validationResult.issuance.details = csValidateIssuanceResult.results

        if (!csValidateIssuanceResult.valid) {
            validationResult.valid = false

            /* Expose an issuance status code. We iterate over the policy array
             * and return the first offender we find. */
            outer: for (const p of csValidateIssuanceResult.results) {
                if (!p.passed) {
                    switch (p.policyId) {
                        case Cs.EIssuanceValidationPolicy.ISSUANCE_EXISTS:
                            validationResult.issuance.status = EIssuanceValidity.ERROR_ISSUANCE_NOT_FOUND
                            break outer
                        case Cs.EIssuanceValidationPolicy.ISSUANCE_NOT_REVOKED:
                            validationResult.issuance.status = EIssuanceValidity.ERROR_ISSUANCE_REVOKED
                            break outer
                        case Cs.EIssuanceValidationPolicy.ISSUER_NOT_REVOKED:
                            validationResult.issuance.status = EIssuanceValidity.ERROR_ISSUER_UNAUTHORIZED
                            break outer
                    }
                }
            }
        }

        return ok({ ...validationResult, signatureValueDigest: signatureValueDigest })
    }

    public async extractAttachments(pdf: Base64): Promise<Result<IExtractAttachmentsResult, Error>> {
        /** HACK: Preliminary implementation. No validation, no error handling.
         *        Based on from https://github.com/Hopding/pdf-lib/issues/534#issuecomment-662756915
         */
        try {
            const pdfDoc = await Pdf.PDFDocument.load(Buffer.from(pdf, "base64"))
            if (!pdfDoc.catalog.has(Pdf.PDFName.of("Names"))) {
                return ok([])
            }
            const names = pdfDoc.catalog.lookup(Pdf.PDFName.of("Names"), Pdf.PDFDict)

            if (!names.has(Pdf.PDFName.of("EmbeddedFiles"))) {
                return ok([])
            }
            const embeddedFiles = names.lookup(Pdf.PDFName.of("EmbeddedFiles"), Pdf.PDFDict)

            if (!embeddedFiles.has(Pdf.PDFName.of("Names"))) {
                return ok([])
            }
            const efNames = embeddedFiles.lookup(Pdf.PDFName.of("Names"), Pdf.PDFArray)

            const attachments: IExtractAttachmentsResult = []
            for (let ii = 0; ii < efNames.size(); ii += 2) {
                const filename = efNames.lookup(ii, Pdf.PDFString).decodeText()
                const stream = efNames
                    .lookup(ii + 1, Pdf.PDFDict)
                    .lookup(Pdf.PDFName.of("EF"), Pdf.PDFDict)
                    .lookup(Pdf.PDFName.of("F"), Pdf.PDFStream)
                const bytes: Buffer = Buffer.from(Pdf.decodePDFRawStream(stream as Pdf.PDFRawStream).decode())
                attachments.push({ filename: filename, bytes: bytes.toString("base64") })
            }
            return ok(attachments)
        } catch (error: unknown) {
            return ok([])
        }
    }

    /**
     * Extract the digest value from a IDigestPdfResponse's bytes.
     *
     * ???: What's the exact data (values and structure) we are dealing with here?
     *      Inspection of the DER-encoded ASN.1 reveals the following structure
     *      SET(2 elem)
     *        SEQUENCE(2 elem)
     *          OBJECT IDENTIFIER 1.2.840.113549.1.9.3
     *          SET(1 elem)
     *            OBJECT IDENTIFIER1.2.840.113549.1.7.1
     *        SEQUENCE(2 elem)
     *          OBJECT IDENTIFIER 1.2.840.113549.1.9.4
     *          SET(1 elem)
     *              OCTET STRING(32 byte) 85D9B433D8A47....
     */
    static extractDigestFromDigestPdfResponse(asn1blob: Buffer): Base64 {
        const asnStruct = ASN1.default.decode(asn1blob)
        const octetString = asnStruct.sub![1].sub![1].sub![0]
        const messageDigest = ASNSchema.AsnParser.parse(Buffer.from(octetString.toB64String(), "base64"), ASNSchema.OctetString)
        const documentHash = Buffer.from(new Uint8Array(messageDigest.buffer)).toString("base64")
        return documentHash
    }
}

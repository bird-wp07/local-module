import * as ASN1 from "@lapo/asn1js"
import * as ASNSchema from "@peculiar/asn1-schema"
import { Result, ok, err } from "neverthrow"
import * as Ioc from "typescript-ioc"
import * as Dss from "../dss"
import * as Cs from "../cs"
import * as crypto from "crypto"
import { EDocumentValidityStatus, EIssuanceStatus, IAppLogic, IHealthStatus, IValidationResult } from "./base"
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
        const response = await this.dssClient.getDataToSign(getDataToSignRequest)
        if (response.isErr()) {
            return err(response.error)
        }

        // ???: Which data structure does DSS#getDataToSign() return here?
        //      See question below.
        const asn1blob = Buffer.from(response.value.bytes, "base64")
        const digest = AppLogic.extractDigestFromDigestPdfResponse(asn1blob)
        return ok(digest)
    }

    public async issueSignature(dataToBeSigned: Base64, issuerId: string, auditLog?: string): Promise<Result<Base64, Error>> {
        const request: Cs.IIssueSignatureRequest = {
            hash: dataToBeSigned,
            digestMethod: Cs.EDigestAlgorithm.SHA256,
            issuerId: issuerId,
            auditLog: auditLog
        }
        const generateSignatureResponse = await this.csClient.issueSignature(request)
        if (generateSignatureResponse.isErr()) {
            return err(generateSignatureResponse.error)
        }
        return ok(generateSignatureResponse.value.cms)
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
        const signDocumentRes = await this.dssClient.signDocument(signDocumentReq)
        if (signDocumentRes.isErr()) {
            return err(signDocumentRes.error)
        }
        return ok(signDocumentRes.value.bytes)
    }

    public async validateSignedPdf(pdf: Base64): Promise<Result<IValidationResult, Error>> {
        /* Check PAdES conformance of signature using DSS. */
        const documentValidity: IValidationResult["document"] = {
            status: EDocumentValidityStatus.DOCUMENT_OK
        }
        const validateSignatureRequest: Dss.IValidateSignatureRequest = {
            signedDocument: {
                bytes: pdf,
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
        const signatures = validateSignatureResponse.value.SimpleReport.signatureOrTimestamp
        const numSignatures = signatures == undefined ? 0 : signatures.length
        if (numSignatures !== 1) {
            if (numSignatures === 0) {
                documentValidity.status = EDocumentValidityStatus.DOCUMENT_INVALID
                documentValidity.details = "no signature found"
            } else {
                documentValidity.status = EDocumentValidityStatus.DOCUMENT_INVALID
                documentValidity.details = "multiple signatures found"
            }
        } else if (signatures![0].Signature.Indication !== Dss.ESignatureValidationIndication.TOTAL_PASSED) {
            documentValidity.status = EDocumentValidityStatus.DOCUMENT_UNTRUSTED
            documentValidity.details = signatures![0].Signature.SubIndication
        }
        const signatureValue: Base64 = validateSignatureResponse.value.DiagnosticData.Signature[0].SignatureValue
        // TODO: abort if dss rejects signature

        /*
         * Check revocation status via the CS.
         *
         * TODO: Implement once the CS API is understood.
         *       The CS requires the digest of the dbts. However, we "only" have the signed PDF.
         *       Thus we must acquire the digest of the dbts
         *       - from the signature, if the CMS does contain it
         *       - from the DSS' validation result above, if it's contained
         *       - from the signed PDF itself (probably the most sane method)
         */
        const issuanceStatus: IValidationResult["issuance"] = {
            status: EIssuanceStatus.ISSUANCE_OK
        }
        const hash = crypto.createHash("sha256").update(Buffer.from(signatureValue, "base64")).digest("base64")
        const csValidationResult = await this.csClient.verifySignature({ digest: hash })
        if (csValidationResult.isErr()) {
            return err(csValidationResult.error)
        }
        if (!csValidationResult.value.valid) {
            issuanceStatus.status = EIssuanceStatus.ISSUANCE_NOT_FOUND
            issuanceStatus.details = csValidationResult.value.results
        }

        /**
         * Verify the validity of the signature via the public CS API. The
         * signature in question is identified via the data that was signed.
         *
         * TODO: Implement once CsClient is ready.
         */
        return ok({
            valid: documentValidity.status == EDocumentValidityStatus.DOCUMENT_OK,
            document: documentValidity,
            issuance: issuanceStatus
        })
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

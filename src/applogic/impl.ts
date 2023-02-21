import * as ASN1 from "@lapo/asn1js"
import * as ASNSchema from "@peculiar/asn1-schema"
import { Result, ok, err } from "neverthrow"
import * as Ioc from "typescript-ioc"
import * as Dss from "../dss"
import * as Cs from "../cs"
import * as Utility from "../utility"
import { EDocumentValidity, EIssuanceValidity, IAppLogic, IHealthStatus, IValidationResult } from "./base"
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

    public async issueSignature(digestToBeSigned: Base64, issuerId: string, auditLog?: string): Promise<Result<Base64, Error>> {
        const digestMethod = Cs.EDigestAlgorithm.SHA256
        const generateSignatureResponse = await this.csClient.issueSignature(digestToBeSigned, digestMethod, issuerId, auditLog)
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
            for (const p of csValidateIssuanceResult.results) {
                if (!p.passed) {
                    switch (p.policyId) {
                        case Cs.EIssuanceValidationPolicy.ISSUANCE_EXISTS:
                            validationResult.issuance.status = EIssuanceValidity.ERROR_ISSUANCE_NOT_FOUND
                            break
                        case Cs.EIssuanceValidationPolicy.ISSUANCE_NOT_REVOKED:
                            validationResult.issuance.status = EIssuanceValidity.ERROR_ISSUANCE_REVOKED
                            break
                        case Cs.EIssuanceValidationPolicy.ISSUER_NOT_REVOKED:
                            validationResult.issuance.status = EIssuanceValidity.ERROR_ISSUER_UNAUTHORIZED
                            break
                    }
                }
            }
        }

        return ok(validationResult)
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

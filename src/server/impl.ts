/**
 * Application logic abstraction "layer"
 */
import * as ASN1 from "@lapo/asn1js"
import * as ASNSchema from "@peculiar/asn1-schema"
import { Result, ok, err } from "neverthrow"
import {
    IDigestPdfRequest,
    IDigestPdfResponse,
    IHealthResponse,
    IMergePdfRequest,
    IMergePdfResponse,
    IValidateSignedPdfRequest,
    IValidateSignedPdfResponse,
    EHealthStatus
} from "./types"
import * as Ioc from "typescript-ioc"
import * as Dss from "../dss"
import { Base64 } from "../utility"

export abstract class IAppLayer {
    public abstract health(): Promise<Result<IHealthResponse, Error>>
    public abstract digestPdf(request: IDigestPdfRequest): Promise<Result<IDigestPdfResponse, Error>>
    public abstract mergePdf(request: IMergePdfRequest): Promise<Result<IMergePdfResponse, Error>>
    public abstract validateSignedPdf(request: IValidateSignedPdfRequest): Promise<Result<IValidateSignedPdfResponse, Error>>
}

/**
 * Implements application logic using DSS and CS API calls.
 *
 * TODO: Spread function arguments into separate pargs for readability
 */
export class AppImpl implements IAppLayer {
    constructor(@Ioc.Inject private dssClient: Dss.IDssClient) {
        this.dssClient = dssClient
    }

    /**
     * Returns system health status depending on the subsystems' health states.
     *
     * TODO: Check CS health.
     */
    public async health(): Promise<Result<IHealthResponse, Error>> {
        let status: EHealthStatus
        if (!(await this.dssClient.isOnline())) {
            status = EHealthStatus.DSS_NO_REPLY
        } else {
            status = EHealthStatus.OK
        }
        return ok({ status: status })
    }

    /**
     * Returns the digest of the data to be signed.
     *
     * The data to be signed consists of the original PDF and a signature
     * section, added as an incremental update. The signature dictionary in the
     * signature section contains the claimed timestamp of the signature in its
     * entry with key 'M'. The digest value thus depends on the timestamp.
     *
     * See EN 319 142-2.
     */
    public async digestPdf(request: IDigestPdfRequest): Promise<Result<IDigestPdfResponse, Error>> {
        const getDataToSignRequest: Dss.IGetDataToSignRequest = {
            toSignDocument: {
                bytes: request.bytes
            },
            parameters: {
                digestAlgorithm: Dss.EDigestAlgorithm.SHA256,
                encryptionAlgorithm: Dss.EEncryptionAlgorithm.ECDSA,
                signatureLevel: Dss.ESignatureLevel.PAdES_B,
                generateTBSWithoutCertificate: true,
                signaturePackaging: Dss.ESignaturePackaging.ENVELOPED,
                signatureAlgorithm: Dss.ESignatureAlgorithm.ECDSA_SHA256,
                blevelParams: {
                    signingDate: request.timestamp
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
        const digest = AppImpl.extractDigestFromDigestPdfResponse(asn1blob)
        return ok({ bytes: digest })
    }

    /**
     * Create a signed PDF from the original PDF which, in conjunction with the
     * signing timestamp, was used to generate the digest sent to the CS in
     * order to create the signature.
     *
     * ???: Is the input the original or the 'data-to-be-signed' version of the document?
     */
    public async mergePdf(request: IMergePdfRequest): Promise<Result<IMergePdfResponse, Error>> {
        const cms = Dss.Utils.parseCms(Buffer.from(request.cms, "base64"))
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

    /**
     * TODOC;
     */
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

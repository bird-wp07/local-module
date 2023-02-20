/**
 * Base definitions of the application logic abstraction layer, outlining the
 * building blocks of a distributed PAdES signature flow within a functional
 * PKI.
 */

import { Result } from "neverthrow"
import { Base64 } from "../utility"

export abstract class IAppLogic {
    /**
     * Returns the digest of a PDF in it's ready-to-be-signed flavor, which
     * consists of the original PDF and a signature section, added as an
     * incremental update. The signature dictionary in the signature section
     * contains the claimed timestamp of the signature in its entry with key
     * 'M'. The digest value thus depends on the timestamp and must be sent
     * along with the PDF. See EN 319 142-2 for further details.
     *
     * @param pdf - base64 encoded PDF
     * @param timestamp - signing timestamp
     * @returns base64 encoded digest to be signed
     */
    abstract generatePdfDigestToBeSigned(pdf: Base64, timestamp: Date): Promise<Result<Base64, Error>>

    /**
     * Issues a signature.
     *
     * @param digestToBeSigned - base64 encoded digest to be signed as returned from generateDataToBeSigned()
     * @param issuerId
     * @param auditLog
     * @returns base64 encoded signature in CMS format
     */
    abstract issueSignature(digestToBeSigned: Base64, issuerId: string, auditLog?: string): Promise<Result<Base64, Error>>

    /**
     * Produces a signed PDF by merging the original PDF with its signature.
     *
     * @param pdf - base64 encoded original PDF used to generate the digest to be signed
     * @param timestamp - original signing timestamp used to generate the digest to be signed
     * @param cms - base64 encoded signature in CMS format as returned by issueSignature()
     * @returns base64 encoded signed PDF
     */
    abstract embedSignatureIntoPdf(pdf: Base64, timestamp: Date, cms: Base64): Promise<Result<Base64, Error>>

    /**
     * Validates a signed PDF.
     *
     * @param pdf - base64 encoded signed PDF as returned by embedSignatureIntoPdf()
     */
    abstract validateSignedPdf(pdf: Base64): Promise<Result<IValidationResult, Error>>

    /**
     * Generic health check.
     */
    abstract health(): Promise<Result<IHealthStatus, Error>>
}

/**
 * Generic status data interface with a machine-readable status code and an
 * optional details field to be read by humans.
 */
export interface IHealthStatus {
    ok: boolean
    details?: any
}

/**
 * Validation result encompassing all aspects of interest of a validation.
 * TODO: wip
 */
export interface IValidationResult {
    /**
     * Overall status, where 'true' implies that each and every aspect of the
     * signature is correct, valid and trustworthy. This field is computed as
     * the conjunction of the validity statuses of the signature's aspects.
     */
    valid: boolean

    /**
     * Aspects concerning the content of the document (bytes inside the pdf+signature container)
     */
    document: {
        status: EDocumentValidityStatus
        details?: any
    }

    /**
     * Revocation check performed by the CS.
     */
    issuance: {
        status: EIssuanceStatus
        details?: any
    }
}

export enum EDocumentValidityStatus {
    DOCUMENT_OK = "DOCUMENT_OK",

    /**
     * Certificate chain unknown
     */
    DOCUMENT_UNTRUSTED = "DOCUMENT_UNTRUSTED",

    /**
     * No signature, multisignature, crypto error
     */
    DOCUMENT_INVALID = "DOCUMENT_INVALID"
}

export enum EIssuanceStatus {
    // Prüfung abgebrochen; Dokument invalide (s.o; keine Signature)
    DOCUMENT_INVALID = "DOCUMENT_INVALID",

    ISSUANCE_OK = "ISSUANCE_OK",
    ISSUANCE_NOT_FOUND = "ISSUANCE_NOT_FOUND",

    // TODO: Check if revoked can be distinguished from NOT_FOUND
    ISSUANCE_REVOKED = "ISSUANCE_REVOKED"
}

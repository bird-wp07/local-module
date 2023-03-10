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
     * @param issuerId - unique ID to identify the issuer
     * @param auditLog - optional audit log
     */
    abstract issueSignature(digestToBeSigned: Base64, issuerId: string, auditLog?: string): Promise<Result<IIssueSignatureResponse, Error>>

    /**
     * Revokes an issuance.
     *
     * @param signatureValueDigest - base64 encoded signature value of the issuance to be revoked
     * @param reason - reason for the revocation
     * @param auditLig - optional audit log
     */
    abstract revokeSignature(signatureValueDigest: Base64, reason: ERevocationReason, auditLog?: string): Promise<Result<IRevocationResponse, Error>>

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
     * Attach files to an existing PDF
     *
     * @param pdf - base64 encoded input PDF
     * @param files - array of dicts containing file's data and the filename to embed
     * @returns base64 encoded PDF with attachments
     */
    abstract attachFiles(pdf: Base64, files: { filename: string; bytes: Base64 }[]): Promise<Result<Base64, Error>>

    /**
     * Extracts attachments from a PDF.
     *
     * @param pdf - base64 encoded PDF
     */
    abstract extractAttachments(pdf: Base64): Promise<Result<IExtractAttachmentsResult, Error>>

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

/* Signature Issuance */
/* ------------------ */

export interface IIssueSignatureResponse {
    /**
     * Base64 encoded signature in CMS format.
     */
    cms: Base64

    /**
     * Base64 encoded SHA256 digest of the signature value used to identify
     * the issuance. The signature value digest can be derived from the
     * information contained within the CMS, but is still returned for
     * convenience.
     */
    signatureValueDigest: Base64
}

/* Signature / issuance revocation */
/* ------------------------------- */

export enum ERevocationReason {
    SECURITY_ISSUE = "SECURITY_ISSUE",
    FORMAL_MISTAKE = "FORMAL_MISTAKE",
    UNSPECIFIED = "UNSPECIFIED"
}

export enum ERevocationStatus {
    ISSUANCE_REVOKED = "ISSUANCE_REVOKED",
    ISSUANCE_NOT_FOUND = "ISSUANCE_NOT_FOUND"
}

export interface IRevocationResponse {
    /**
     * Status code
     */
    status: ERevocationStatus

    /**
     * Revocation date in case of revoked, or already revoked issuance.
     */
    revocationDate?: Date
}

/**
 * Validation result encompassing all aspects of interest of a validation.
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
        status: EDocumentValidity
        details?: any
    }

    /**
     * Revocation check performed by the CS.
     */
    issuance: {
        status: EIssuanceValidity
        details?: any
    }

    /**
     * Base64 encoded SHA256 digest of the PDF's signature's signature value.
     * Returned only if document is valid.
     */
    signatureValueDigest?: Base64
}

export enum EDocumentValidity {
    /**
     * All good.
     */
    DOCUMENT_OK = "DOCUMENT_OK",

    /**
     * E.g. certificate chain unknown
     */
    ERROR_DOCUMENT_UNTRUSTED = "ERROR_DOCUMENT_UNTRUSTED",

    /**
     * No signature, multisignature, crypto error
     */
    ERROR_DOCUMENT_INVALID = "ERROR_DOCUMENT_INVALID"
}

export enum EIssuanceValidity {
    /**
     * All good.
     */
    ISSUANCE_OK = "ISSUANCE_OK",

    /**
     * Return if document validation failed in which case no issuance
     * validation is performed.
     */
    ERROR_DOCUMENT_INVALID = "ERROR_DOCUMENT_INVALID",

    /**
     * No signature has been issuance.
     */
    ERROR_ISSUANCE_NOT_FOUND = "ERROR_ISSUANCE_NOT_FOUND",

    /**
     * A signature was issued but has been revoked since.
     */
    ERROR_ISSUANCE_REVOKED = "ERROR_ISSUANCE_REVOKED",

    /**
     * The issuer is unauthorized.
     *
     * ???: What does this even mean?
     */
    ERROR_ISSUER_UNAUTHORIZED = "ERROR_ISSUER_UNAUTHORIZED"
}

/* Attachment extraction */
/* --------------------- */
export type IExtractAttachmentsResult = {
    /**
     * Name of the attached file.
     */
    filename: string

    /**
     * Base64 encoded file data.
     */
    bytes: Base64
}[]

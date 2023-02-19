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
     * @returns base64 encoded digest
     */
    abstract generateDataToBeSigned(pdf: Base64, timestamp: Date): Promise<Result<Base64, Error>>

    /**
     * Generates a signature.
     *
     * @param dataToBeSigned - base64 encoded data to be signed
     * @returns base64 encoded signature in CMS format
     */
    abstract generateSignature(dataToBeSigned: Base64): Promise<Result<Base64, Error>>

    /**
     * Produces a signed PDF by merging the original PDF with its signature.
     *
     * @param pdf - base64 encoded original PDF used to generate the data to be signed
     * @param timestamp - original signing timestamp used to generate the data to be signed
     * @param cms - base64 encoded signature in CMS format
     * @returns base64 encoded signed PDF
     */
    abstract embedSignatureIntoPdf(pdf: Base64, timestamp: Date, cms: Base64): Promise<Result<Base64, Error>>

    /**
     * Validates a signed PDF.
     *
     * @param pdf - base64 encoded signed PDF
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
     * Granular subaspects determining the validity of the signature.
     */
    aspects: {
        /**
         * PAdES conformance as checked by DSS.
         */
        pades: {
            status: EPadesConformanceStatus
            details?: any
        }

        /**
         * Revocation check performed by the CS.
         */
        revocation: {
            status: ERevocationStatus
            details?: any
        }
    }
}

export enum EPadesConformanceStatus {
    OK = "OK",
    NO_SIGNATURE = "NO_SIGNATURE",
    MULTIPLE_SIGNATURES = "MULTIPLE_SIGNATURES", // multi-signatures currently not implemented
    INVALID_SIGNATURE = "INVALID_SIGNATURE"
}

export enum ERevocationStatus {
    OK = "OK",
    REVOKED = "REVOKED"
}

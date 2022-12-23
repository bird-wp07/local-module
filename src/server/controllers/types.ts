// FIXME: tsoa does not recognize globally defined types in src/types/global.d.ts
//        It would be nice to define Base64 globally as it's used everywhere,

import * as Dss from "../../dss"

//        literally.
export type Base64 = string

export interface IDigestBlobRequest {
    base64: Base64
    digestAlgorithm: Dss.EDigestAlgorithm
}

export interface IDigestBlobResponse {
    digest: Base64
}

export interface IDigestPDFRequest {
    digestAlgorithm: Dss.EDigestAlgorithm,
    base64: Base64,
    signingTimestamp: number
}

export interface IDigestPDFResponse {
    digest: Base64
}

export function dtbsFromDigestRequest (dto: IDigestPDFRequest): Dss.IGetDataToSignRequest {
    return {
        toSignDocument: {
            bytes: dto.base64
        },
        parameters: {
            digestAlgorithm: dto.digestAlgorithm,
            signatureLevel: Dss.ESignatureLevel.PAdES_B,
            generateTBSWithoutCertificate: true,
            blevelParams : {
                signingDate : dto.signingTimestamp
              }
        }
    }
}

export interface IMergePDFRequest {
    base64: Base64
    signatureAsCMS: Base64
    timestamp: number
}

export interface IMergePDFResponse {
    base64: Base64
}

export interface IValidateSignedPdfResponse {
    result: Dss.ESignatureValidationIndication
    reason: Dss.ESignatureValidationSubIndication | "NO_SIGNATURE" | null
}

export interface IValidateSignedPdfRequest {
    bytes: Base64
}
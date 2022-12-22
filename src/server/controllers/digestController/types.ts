import { ESignatureLevel, IGetDataToSignRequest } from "../../../dss"
import { Base64 } from "../types"

export enum EDigestAlgorithm {
    SHA1 = "SHA1",
    SHA224 = "SHA224",
    SHA256 = "SHA256",
    SHA512 = "SHA512"
}

export interface IDigestBlobRequest {
    bytes: Base64
    digestAlgorithm: EDigestAlgorithm
}

export interface IDigestBlobResponse {
    bytes: Base64
}

export interface IDigestPDFRequest {
    digestAlgorithm: EDigestAlgorithm,
    base64: Base64,
    signingTimestamp: number
}

export interface IDigestPDFResponse {
    bytes: Base64
}

export function dtbsFromDigestRequest (dto: IDigestPDFRequest): IGetDataToSignRequest {
    return {
        toSignDocument: {
            bytes: dto.base64
        },
        parameters: {
            digestAlgorithm: dto.digestAlgorithm,
            signatureLevel: ESignatureLevel.PAdES_B,
            generateTBSWithoutCertificate: true,
            blevelParams : {
                signingDate : dto.signingTimestamp
              }
        }
    }
}
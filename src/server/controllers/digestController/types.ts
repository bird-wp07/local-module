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
    bytes: Base64
    digestAlgorithm: EDigestAlgorithm
}

export interface IDigestPDFResponse {
    bytes: Base64
}

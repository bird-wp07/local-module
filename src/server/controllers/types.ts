// FIXME: tsoa does not recognize globally defined types in src/types/global.d.ts
//        It would be nice to define Base64 globally as it's used everywhere,
//        literally.
export type Base64 = string

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

export interface IMergePDFRequest {
    bytes: Base64
    signatureAsCMS: Base64
    timestamp: number
}

export interface IMergePDFResponse {
    bytes: Base64
}

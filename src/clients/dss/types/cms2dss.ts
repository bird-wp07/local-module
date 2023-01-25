/* eslint-disable */
import ASN1 from "@lapo/asn1js"
import { EDigestAlgorithm, ESignatureAlgorithm, ESignatureLevel, ESignaturePackaging, IDssCert, ISignDocumentRequest } from "./dss"
import { OIDS } from "./oids"
import * as ASNSchema from "@peculiar/asn1-schema"
import { SignedData } from "@peculiar/asn1-cms"

export interface ICms2DssResponse {
    cmsContent: ICmsContent
    dssParams: ISignDocumentRequest
}

export interface ICmsContent {
    digestAlgorithm: string
    contentType: string
    signerInfo: ICmsSignerInfo
    signerInfoBase64: string
    certificates: string[]
}

export interface ICmsSignerInfo {
    version: number
    names?: string[]
    digestAlgorithm: EDigestAlgorithm
    signatureAlgorithm: ESignatureAlgorithm
    signature: string
    signedAttributes?: string[]
}

export const OIDS2DSS = {
    ecdsaWithSHA256: "ECDSA_SHA256",
    ecdsaWithSHA256_digest: "SHA256",
    ecdsaWithSHA256_encryption: "ECDSA"
}
export enum OIDS2DSSMappingType {
    Default = "",
    Digest = "digest",
    Encryption = "encryption"
}

export function mapOIDValueAsDigest(oidValue: string) {
    return mapOIDValue(oidValue, OIDS2DSSMappingType.Digest)
}

export function mapOIDValueAsEncryption(oidValue: string) {
    return mapOIDValue(oidValue, OIDS2DSSMappingType.Encryption)
}

export function mapOIDValue(oidValue: string, type: OIDS2DSSMappingType = OIDS2DSSMappingType.Default) {
    const OIDS2DSSMapping = OIDS2DSS as any
    const mapping = type ? `${oidValue}_${type}` : oidValue
    const value = OIDS2DSSMapping[mapping]
    if (!value) return oidValue
    return value
}

/* eslint-disable */
export function convert(base64OfCMS: string): ICms2DssResponse {
    const OIDRepository = OIDS as any

    const asn1 = ASN1.decode(Buffer.from(base64OfCMS, "base64"))

    // Ignore the PKCS#7 Header Data, start with the first SEQUENCE within (Signed Data)
    const signedData = asn1.sub![1].sub![0]

    const cms = ASNSchema.AsnParser.parse(Buffer.from(signedData.toB64String(), "base64"), SignedData)

    const digestAlgorithm = mapOIDValueAsDigest(OIDRepository[cms.digestAlgorithms[0].algorithm].d)
    const contentType = OIDRepository[cms.encapContentInfo.eContentType].d
    const signerInfoDigestAlgorithm = "" + cms.signerInfos[0].digestAlgorithm.algorithm
    const signerInfoBase64 = Buffer.from(ASNSchema.AsnSerializer.serialize(cms.signerInfos[0])).toString("base64")

    const signerInfo: ICmsSignerInfo = {
        version: cms.signerInfos[0].version,
        names: cms.signerInfos[0].sid.issuerAndSerialNumber?.issuer.map((value: any) => {
            if (OIDRepository[value[0].type]) {
                return `${OIDRepository[value[0].type].d as string} = ${value[0].value as string}`
            }
            return `${value[0].type as string} = ${value[0].value as string}`
        }),
        digestAlgorithm: mapOIDValueAsDigest(OIDRepository[signerInfoDigestAlgorithm].d),
        signatureAlgorithm: mapOIDValue(OIDRepository[cms.signerInfos[0].signatureAlgorithm.algorithm].d),
        signature: Buffer.from(cms.signerInfos[0].signature.buffer).toString("base64"),
        signedAttributes: cms.signerInfos[0].signedAttrs?.map((value: any) => {
            if (OIDRepository[value.attrType]) {
                return `${OIDRepository[value.attrType].d as string} = ${Buffer.from(value.attrValues[0]).toString("base64")}`
            }
            return `${value.attrType} = ${Buffer.from(value.attrValues[0]).toString("base64")}`
        })
    }
    const certificates: any[] = []
    cms.certificates?.forEach((value: any) => {
        certificates.push(Buffer.from(ASNSchema.AsnSerializer.serialize(value)).toString("base64"))
    })
    const dssCertificateChain: IDssCert[] = []
    certificates.forEach((value: string) => {
        dssCertificateChain.push({
            encodedCertificate: value
        })
    })

    return {
        cmsContent: {
            digestAlgorithm,
            contentType,
            signerInfo,
            signerInfoBase64,
            certificates
        },
        dssParams: {
            parameters: {
                certificateChain: dssCertificateChain,
                digestAlgorithm: digestAlgorithm,
                generateTBSWithoutCertificate: false,
                signWithExpiredCertificate: false,
                signatureAlgorithm: signerInfo.signatureAlgorithm,
                signaturePackaging: ESignaturePackaging.ENVELOPED,
                signatureLevel: ESignatureLevel.PAdES_B,
                signingCertificate: dssCertificateChain[0]
            },
            signatureValue: {
                algorithm: signerInfo.signatureAlgorithm,
                value: signerInfo.signature
            }
        }
    }
}
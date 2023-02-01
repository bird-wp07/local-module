/* eslint-disable */
import { AsnParser, AsnSerializer } from "@peculiar/asn1-schema"
import { SignedData } from "@peculiar/asn1-cms"
import { OIDS } from "./oids"
import { OIDS2DSS, OIDS2DSSMappingType } from "./oids2dss"
import * as Dss from "../dss"

import ASN1 from "@lapo/asn1js"
import { Base64 } from "../types/common"

export interface ICms2DssResponse {
    cmsContent: ICmsContent
    dssParams: ISignDocumentRequest
}

export interface IDssCert {
    encodedCertificate: string
}

export interface IDssBLevelParams {
    signingDate: number
}

export interface IDssSigningParams {
    signWithExpiredCertificate: false
    generateTBSWithoutCertificate: false
    signatureLevel: Dss.ESignatureLevel
    signaturePackaging?: Dss.ESignaturePackaging
    signatureAlgorithm?: Dss.ESignatureAlgorithm
    encryptionAlgorithm?: Dss.EEncryptionAlgorithm
    digestAlgorithm: Dss.EDigestAlgorithm
    signingCertificate: IDssCert
    certificateChain: IDssCert[]
    blevelParams?: IDssBLevelParams
}
export interface IDssSignatureValue {
    algorithm: Dss.ESignatureAlgorithm
    value: string
}

export interface ISignDocumentRequest {
    toSignDocument?: {
        bytes: Base64
    }
    parameters: IDssSigningParams
    signatureValue: IDssSignatureValue
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
    digestAlgorithm: Dss.EDigestAlgorithm
    signatureAlgorithm: Dss.ESignatureAlgorithm
    signature: string
    signedAttributes?: string[]
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

export function convert(base64OfCMS: string): ICms2DssResponse {
    const OIDRepository = OIDS as any

    const asn1 = ASN1.decode(Buffer.from(base64OfCMS, "base64"))

    // Ignore the PKCS#7 Header Data, start with the first SEQUENCE within (Signed Data)
    const signedData = asn1.sub![1].sub![0]

    const cms = AsnParser.parse(Buffer.from(signedData.toB64String(), "base64"), SignedData)

    const digestAlgorithm = mapOIDValueAsDigest(OIDRepository[cms.digestAlgorithms[0].algorithm].d)
    const contentType = OIDRepository[cms.encapContentInfo.eContentType].d
    const signerInfoDigestAlgorithm = "" + cms.signerInfos[0].digestAlgorithm.algorithm
    const signerInfoBase64 = Buffer.from(AsnSerializer.serialize(cms.signerInfos[0])).toString("base64")

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
        certificates.push(Buffer.from(AsnSerializer.serialize(value)).toString("base64"))
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
                signaturePackaging: Dss.ESignaturePackaging.ENVELOPED,
                signatureLevel: Dss.ESignatureLevel.PAdES_B,
                signingCertificate: dssCertificateChain[0]
            },
            signatureValue: {
                algorithm: signerInfo.signatureAlgorithm,
                value: signerInfo.signature
            }
        }
    }
}

/**
 * Parses a CMS structure and returns certain fields of interest in their
 * cleartext name.
 */
export function parseCms(cms: Buffer): ICmsContent {
    const OIDRepository = OIDS as any

    const asn1 = ASN1.decode(cms)
    // const asn1 = ASN1.decode(Buffer.from(cms, "base64"))

    // Ignore the PKCS#7 Header Data, start with the first SEQUENCE within (Signed Data)
    const signedData = asn1.sub![1].sub![0]

    const cmsStruct = AsnParser.parse(Buffer.from(signedData.toB64String(), "base64"), SignedData)

    const digestAlgorithm = mapOIDValueAsDigest(OIDRepository[cmsStruct.digestAlgorithms[0].algorithm].d)
    const contentType = OIDRepository[cmsStruct.encapContentInfo.eContentType].d
    const signerInfoDigestAlgorithm = "" + cmsStruct.signerInfos[0].digestAlgorithm.algorithm
    const signerInfoBase64 = Buffer.from(AsnSerializer.serialize(cmsStruct.signerInfos[0])).toString("base64")

    const signerInfo: ICmsSignerInfo = {
        version: cmsStruct.signerInfos[0].version,
        names: cmsStruct.signerInfos[0].sid.issuerAndSerialNumber?.issuer.map((value: any) => {
            if (OIDRepository[value[0].type]) {
                return `${OIDRepository[value[0].type].d as string} = ${value[0].value as string}`
            }
            return `${value[0].type as string} = ${value[0].value as string}`
        }),
        digestAlgorithm: mapOIDValueAsDigest(OIDRepository[signerInfoDigestAlgorithm].d),
        signatureAlgorithm: mapOIDValue(OIDRepository[cmsStruct.signerInfos[0].signatureAlgorithm.algorithm].d),
        signature: Buffer.from(cmsStruct.signerInfos[0].signature.buffer).toString("base64"),
        signedAttributes: cmsStruct.signerInfos[0].signedAttrs?.map((value: any) => {
            if (OIDRepository[value.attrType]) {
                return `${OIDRepository[value.attrType].d as string} = ${Buffer.from(value.attrValues[0]).toString("base64")}`
            }
            return `${value.attrType} = ${Buffer.from(value.attrValues[0]).toString("base64")}`
        })
    }
    const certificates: any[] = []
    cmsStruct.certificates?.forEach((value: any) => {
        certificates.push(Buffer.from(AsnSerializer.serialize(value)).toString("base64"))
    })
    const dssCertificateChain: IDssCert[] = []
    certificates.forEach((value: string) => {
        dssCertificateChain.push({
            encodedCertificate: value
        })
    })

    return {
            digestAlgorithm,
            contentType,
            signerInfo,
            signerInfoBase64,
            certificates
    }
}

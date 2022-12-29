/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { AsnParser, AsnSerializer } from "@peculiar/asn1-schema"
import { SignedData } from "@peculiar/asn1-cms"
import { OIDS } from "./oids"
import { OIDS2DSS, OIDS2DSSMappingType } from "./oids2dss"

import ASN1 from "@lapo/asn1js"
import { Base64 } from "../types/common"

export interface CMS2DSSResponse {
    cmsContent: CMSContent
    dssParams: DSSParams
}

export enum DSSSignatureLevel {
    PADES_B = "PAdES_BASELINE_B",
    PADES_T = "PAdES_BASELINE_T",
    PADES_LT = "PAdES_BASELINE_LT",
    PADES_LTA = "PAdES_BASELINE_LTA"
}

export enum DSSSignatureAlgorithm {
    ECDSA_SHA256 = "ECDSA_SHA256"
}

export enum DSSEncryptionAlgorithm {
    ECDSA = "ECDSA"
}

export enum DSSDigestAlgorithm {
    SHA256 = "SHA256"
}

export enum DSSSignaturePackaging {
    ENVELOPING = "ENVELOPING",
    ENVELOPED = "ENVELOPED"
}

export interface DSSCert {
    encodedCertificate: string
}

export interface DSSBLevelParams {
    signingDate: number
}

export interface DSSSigningParams {
    signWithExpiredCertificate: false
    generateTBSWithoutCertificate: false
    signatureLevel: DSSSignatureLevel
    signaturePackaging?: DSSSignaturePackaging
    signatureAlgorithm?: DSSSignatureAlgorithm
    encryptionAlgorithm?: DSSEncryptionAlgorithm
    digestAlgorithm: DSSDigestAlgorithm
    signingCertificate: DSSCert
    certificateChain: DSSCert[]
    blevelParams?: DSSBLevelParams
}
export interface DSSSignatureValue {
    algorithm: DSSSignatureAlgorithm
    value: string
}

export interface DSSBytes {
    bytes: Base64
}
export interface DSSParams {
    toSignDocument?: DSSBytes
    parameters: DSSSigningParams
    signatureValue: DSSSignatureValue
}

export interface CMSContent {
    digestAlgorithm: string
    contentType: string
    signerInfo: CMSSignerInfo
    signerInfoBase64: string
    certificates: string[]
}

export interface CMSSignerInfo {
    version: number
    names?: string[]
    digestAlgorithm: DSSDigestAlgorithm
    signatureAlgorithm: DSSSignatureAlgorithm
    signature: string
    signedAttributes?: string[]
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class CMS2DSS {
    private static mapOIDValueAsDigest(oidValue: string) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return this.mapOIDValue(oidValue, OIDS2DSSMappingType.Digest)
    }
    private static mapOIDValueAsEncryption(oidValue: string) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return this.mapOIDValue(oidValue, OIDS2DSSMappingType.Encryption)
    }
    private static mapOIDValue(oidValue: string, type: OIDS2DSSMappingType = OIDS2DSSMappingType.Default) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const OIDS2DSSMapping = OIDS2DSS as any
        const mapping = type ? `${oidValue}_${type}` : oidValue
        const value = OIDS2DSSMapping[mapping]
        if (!value) return oidValue
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return value
    }
    public static convert(base64OfCMS: string): CMS2DSSResponse {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const OIDRepository = OIDS as any

        const asn1 = ASN1.decode(Buffer.from(base64OfCMS, "base64"))

        // Ignore the PKCS#7 Header Data, start with the first SEQUENCE within (Signed Data)
        const signedData = asn1.sub![1].sub![0]

        const cms = AsnParser.parse(Buffer.from(signedData.toB64String(), "base64"), SignedData)

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const digestAlgorithm = CMS2DSS.mapOIDValueAsDigest(OIDRepository[cms.digestAlgorithms[0].algorithm].d)
        const contentType = OIDRepository[cms.encapContentInfo.eContentType].d
        const signerInfoDigestAlgorithm = "" + cms.signerInfos[0].digestAlgorithm.algorithm
        const signerInfoBase64 = Buffer.from(AsnSerializer.serialize(cms.signerInfos[0])).toString("base64")

        const signerInfo: CMSSignerInfo = {
            version: cms.signerInfos[0].version,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            names: cms.signerInfos[0].sid.issuerAndSerialNumber?.issuer.map((value: any) => {
                if (OIDRepository[value[0].type]) {
                    return `${OIDRepository[value[0].type].d as string} = ${value[0].value as string}`
                }
                return `${value[0].type as string} = ${value[0].value as string}`
            }),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            digestAlgorithm: this.mapOIDValueAsDigest(OIDRepository[signerInfoDigestAlgorithm].d),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            signatureAlgorithm: this.mapOIDValue(OIDRepository[cms.signerInfos[0].signatureAlgorithm.algorithm].d),
            signature: Buffer.from(cms.signerInfos[0].signature.buffer).toString("base64"),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            signedAttributes: cms.signerInfos[0].signedAttrs?.map((value: any) => {
                if (OIDRepository[value.attrType]) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    return `${OIDRepository[value.attrType].d as string} = ${Buffer.from(value.attrValues[0]).toString("base64")}`
                }
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-argument
                return `${value.attrType} = ${Buffer.from(value.attrValues[0]).toString("base64")}`
            })
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const certificates: any[] = []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cms.certificates?.forEach((value: any) => {
            certificates.push(Buffer.from(AsnSerializer.serialize(value)).toString("base64"))
        })
        const dssCertificateChain: DSSCert[] = []
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
                    signaturePackaging: DSSSignaturePackaging.ENVELOPED,
                    signatureLevel: DSSSignatureLevel.PADES_B,
                    signingCertificate: dssCertificateChain[0]
                },
                signatureValue: {
                    algorithm: signerInfo.signatureAlgorithm,
                    value: signerInfo.signature
                }
            }
        }
    }
}

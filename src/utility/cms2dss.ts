/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { AsnParser, AsnSerializer } from "@peculiar/asn1-schema"
import { SignedData } from "@peculiar/asn1-cms"
import { OIDS } from "./oids"
import { OIDS2DSS, OIDS2DSSMappingType } from "./oids2dss"

import ASN1 from "@lapo/asn1js"



export interface CMS2DSSResponse {
    cmsContent: CMSContent
    dssParams: DSSParams
}

export enum DSSSignatureLevel {
    PADES_B = "PAdES_BASELINE_B",
    PADES_T = "PAdES_BASELINE_T",
    PADES_LT = "PAdES_BASELINE_LT",
    PADES_LTA = "PAdES_BASELINE_LTA",
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
    signWithExpiredCertificate: false,
  generateTBSWithoutCertificate: false,
  signatureLevel: DSSSignatureLevel
  signaturePackaging?: DSSSignaturePackaging,
  signatureAlgorithm?: DSSSignatureAlgorithm,
  encryptionAlgorithm?: DSSEncryptionAlgorithm,
  digestAlgorithm: DSSDigestAlgorithm,
  signingCertificate: DSSCert,
  certificateChain: DSSCert[],
    blevelParams?: DSSBLevelParams
}
export interface DSSSignatureValue {
    algorithm: DSSSignatureAlgorithm,
    value: string
}

export interface DSSBytes {
    bytes: string
}
export interface DSSParams {
    toSignDocument?: DSSBytes
    parameters: DSSSigningParams
    signatureValue: DSSSignatureValue
}

export interface CMSContent {
    digestAlgorithm: string
    contentType:string
    signerInfo:CMSSignerInfo,
    signerInfoBase64:string
    certificates:string[]
}

export interface CMSSignerInfo {
    version: number
    names?: string[]
    digestAlgorithm: DSSDigestAlgorithm
    signatureAlgorithm: DSSSignatureAlgorithm
    signature: string
    signedAttributes?: string[]
}

export class CMS2DSS {
    private static mapOIDValueAsDigest(oidValue:string) {
        return this.mapOIDValue(oidValue, OIDS2DSSMappingType.Digest)
    }
    private static mapOIDValueAsEncryption(oidValue:string) {
        return this.mapOIDValue(oidValue, OIDS2DSSMappingType.Encryption)
    }
    private static mapOIDValue(oidValue:string, type:OIDS2DSSMappingType = OIDS2DSSMappingType.Default) {
        const OIDS2DSSMapping = OIDS2DSS as any
        const mapping = type ? `${oidValue}_${type}` : oidValue
        const value = OIDS2DSSMapping[mapping]
        if (!value) return oidValue
        return value
    }
    public static convert(base64OfCMS:string):CMS2DSSResponse {
        const OIDRepository = OIDS as any
        
        const asn1 = ASN1.decode(Buffer.from(base64OfCMS, "base64"))

        // Ignore the PKCS#7 Header Data, start with the first SEQUENCE within (Signed Data)
        const signedData = asn1.sub![1].sub![0]

        const cms = AsnParser.parse(Buffer.from(signedData.toB64String(), "base64"), SignedData)

        const digestAlgorithm = CMS2DSS.mapOIDValueAsDigest(OIDRepository[cms.digestAlgorithms[0].algorithm].d)
        const contentType = OIDRepository[cms.encapContentInfo.eContentType].d
        const signerInfoDigestAlgorithm = "" + (cms.signerInfos[0].digestAlgorithm.algorithm as string)
        const signerInfoBase64 = Buffer.from(AsnSerializer.serialize(cms.signerInfos[0])).toString("base64")

        const signerInfo:CMSSignerInfo = {
            version: cms.signerInfos[0].version,
            names: cms.signerInfos[0].sid.issuerAndSerialNumber?.issuer.map((value:any) => {
                if (OIDRepository[value[0].type]) {
                    return `${OIDRepository[value[0].type].d as string} = ${value[0].value as string}`
                }
                return `${value[0].type as string} = ${value[0].value as string}`
            }),
            digestAlgorithm: this.mapOIDValueAsDigest(OIDRepository[signerInfoDigestAlgorithm].d),
            signatureAlgorithm: this.mapOIDValue(OIDRepository[cms.signerInfos[0].signatureAlgorithm.algorithm as string].d),
            signature: Buffer.from(cms.signerInfos[0].signature.buffer).toString("base64"),
            signedAttributes: cms.signerInfos[0].signedAttrs?.map((value:any) => {
                if (OIDRepository[value.attrType]) {
                    return `${OIDRepository[value.attrType].d as string} = ${Buffer.from(value.attrValues[0]).toString("base64")}`
                }
                return `${value.attrType} = ${Buffer.from(value.attrValues[0]).toString("base64")}`
            })
        }
        const certificates: any[] = []
        cms.certificates?.forEach((value:any) => {
            certificates.push(Buffer.from(AsnSerializer.serialize(value)).toString("base64"))
        })
        const dssCertificateChain:DSSCert[] = []
        certificates.forEach((value:string) => {
            dssCertificateChain.push({
                encodedCertificate: value
            })
        });

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



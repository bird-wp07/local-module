/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { AsnParser, AsnSerializer } from "@peculiar/asn1-schema"
import { SignedData } from "@peculiar/asn1-cms"
import { OIDS } from "./oids"

import ASN1 from "@lapo/asn1js"

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
    digestAlgorithm: string
    signatureAlgorithm: string
    signature: string
    signedAttributes?: string[]
}

export class CMS2DSS {
    public static convert(base64OfCMS:string):CMSContent {
        const OIDRepository = OIDS as any
        const asn1 = ASN1.decode(Buffer.from(base64OfCMS, "base64"))

        // Ignore the PKCS#7 Header Data, start with the first SEQUENCE within (Signed Data)
        const signedData = asn1.sub![1].sub![0]

        const cms = AsnParser.parse(Buffer.from(signedData.toB64String(), "base64"), SignedData)

        const digestAlgorithm = OIDRepository[cms.digestAlgorithms[0].algorithm].d
        const contentType = OIDRepository[cms.encapContentInfo.eContentType].d
        const signerInfoDigestAlgorithm = "" + (cms.signerInfos[0].digestAlgorithm.algorithm as string)
        const signerInfoBase64 = Buffer.from(AsnSerializer.serialize(cms.signerInfos[0])).toString("base64")

        const signerInfo:CMSSignerInfo = {
            version: cms.signerInfos[0].version,
            names: cms.signerInfos[0].sid.issuerAndSerialNumber?.issuer.map((value, index) => {
                if (OIDRepository[value[0].type]) {
                    return `${OIDRepository[value[0].type].d as string} = ${value[0].value as string}`
                }
                return `${value[0].type as string} = ${value[0].value as string}`
            }),
            digestAlgorithm: OIDRepository[signerInfoDigestAlgorithm].d,
            signatureAlgorithm: OIDRepository[cms.signerInfos[0].signatureAlgorithm.algorithm as string].d,
            signature: Buffer.from(cms.signerInfos[0].signature.buffer).toString("base64"),
            signedAttributes: cms.signerInfos[0].signedAttrs?.map((value, index) => {
                if (OIDRepository[value.attrType]) {
                    return `${OIDRepository[value.attrType].d as string} = ${Buffer.from(value.attrValues[0]).toString("base64")}`
                }
                return `${value.attrType} = ${Buffer.from(value.attrValues[0]).toString("base64")}`
            })
        }
        const certificates: any[] = []
        cms.certificates?.forEach((value, index) => {
            certificates.push(Buffer.from(AsnSerializer.serialize(value)).toString("base64"))
        })
        return {
            digestAlgorithm,
            contentType,
            signerInfo,
            signerInfoBase64,
            certificates
        }
    }
}



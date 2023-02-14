import * as Dss from "."
import { Base64 } from "../types"

import * as ASN1CMS from "@peculiar/asn1-cms"
import * as ASN1Schema from "@peculiar/asn1-schema"
import ASN1 from "@lapo/asn1js"
import { ok, err, Result } from "neverthrow"

/**
 * Parses a CMS buffer, extracting specific fields converted to DSS specific
 * entities. See https://www.rfc-editor.org/rfc/rfc5652 for detailed information
 * about the anatomy of the CMS.
 *
 * HACK: This function makes unvalidated assumptions about the structure of the
 *       CMS and is implemented as needed. The function can throw exceptions.
 */
export function parseCms(cms: Buffer): {
    digestAlgorithm: Dss.EDigestAlgorithm
    signatureAlgorithm: Dss.ESignatureAlgorithm
    signatureValue: Base64
    certificateChain: Record<"encodedCertificate", Base64>[]
    signingCertificate: Record<"encodedCertificate", Base64>
} {
    /* Skip ahead to Signed-Data content type. See https://www.rfc-editor.org/rfc/rfc5652#page-8 */
    const asn1 = ASN1.decode(cms)
    const signedData: ASN1 = asn1.sub![1].sub![0]
    const signedDataStruct = ASN1Schema.AsnParser.parse(Buffer.from(signedData.toB64String(), "base64"), ASN1CMS.SignedData)

    /* Extract digest algorithm */
    const digestAlgOid = signedDataStruct.digestAlgorithms[0].algorithm
    const digestAlgorithm = OIDLookup(digestAlgOid)._unsafeUnwrap() as Dss.EDigestAlgorithm

    /* Extract signature value, base64 encoded */
    const signatureValue = Buffer.from(signedDataStruct.signerInfos[0].signature.buffer).toString("base64")

    /* Extract signature algorithm */
    const signatureAlgOid = signedDataStruct.signerInfos[0].signatureAlgorithm.algorithm
    const signatureAlgorithm = OIDLookup(signatureAlgOid)._unsafeUnwrap() as Dss.ESignatureAlgorithm

    /* Extract certificates, base64 encoded */
    const certificateChain: Record<"encodedCertificate", Base64>[] = []
    for (const c of signedDataStruct.certificates!) {
        const cert = Buffer.from(ASN1Schema.AsnSerializer.serialize(c)).toString("base64")
        certificateChain.push({ encodedCertificate: cert })
    }
    const signingCertificate = certificateChain[0]

    return {
        digestAlgorithm,
        signatureAlgorithm,
        signatureValue,
        certificateChain,
        signingCertificate
    }
}

/**
 * OID lookup table returning DSS specific entities. OIDs are implemented as
 * needed and unmapped OIDs will return an error.
 *
 * See http://oid-info.com for information about individual OIDs.
 */
function OIDLookup(oid: string): Result<unknown, Error> {
    const lut: Record<string, unknown> = {
        "2.16.840.1.101.3.4.2.1": Dss.EDigestAlgorithm.SHA256,
        "1.2.840.10045.4.3.2": Dss.ESignatureAlgorithm.ECDSA_SHA256
    }

    if (!Object.keys(lut).includes(oid)) {
        return err(new Error(`key ${oid} does not exist in lut`))
    }
    return ok(lut[oid])
}

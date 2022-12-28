import { dtbsFromDigestRequest, IDigestPDFRequest, IDigestPDFResponse } from "../types"
import * as ASNSchema from "@peculiar/asn1-schema"
import ASN1 from "@lapo/asn1js"
import { DssClient, IGetDataToSignRequest } from "../../../dss"

/**
 * ```asn
 * MessageDigest ::= OCTET STRING
 * ```
 */
class MessageDigest extends ASNSchema.OctetString {}

export class DigestFacade {
    private dssClient: DssClient
    constructor(dssClient: DssClient) {
        this.dssClient = dssClient
    }

    public async digestPDF(request: IDigestPDFRequest): Promise<IDigestPDFResponse> {
        const DSSrequest: IGetDataToSignRequest = dtbsFromDigestRequest(request)
        const DSSReponse = await this.dssClient.getDataToSign(DSSrequest)
        if (DSSReponse.isErr()) {
            throw DSSReponse.error
        }

        const encodedDigest = ASN1.decode(Buffer.from(DSSReponse.value.bytes, "base64"))
        const octetString = encodedDigest.sub![1].sub![1].sub![0]
        const messageDigest = ASNSchema.AsnParser.parse(Buffer.from(octetString.toB64String(), "base64"), MessageDigest)
        const documentHash = Buffer.from(new Uint8Array(messageDigest.buffer)).toString("base64")
        return { digest: documentHash } as IDigestPDFResponse
    }
}

import { IDigestPDFRequest, IDigestPDFResponse } from "../types"
import * as ASNSchema from "@peculiar/asn1-schema"
import ASN1 from "@lapo/asn1js"
import { DssClient, ESignatureLevel, IGetDataToSignRequest } from "../../../dss"

/**
 * ```asn
 * MessageDigest ::= OCTET STRING
 * ```
 */
class MessageDigest extends ASNSchema.OctetString {}

export class DigestFacade {
    public dssClient: DssClient
    constructor(dssClient: DssClient) {
        this.dssClient = dssClient
    }

    // TODO: neverthrow
    public async digestPDF(request: IDigestPDFRequest): Promise<IDigestPDFResponse> {
        const dssRequest: IGetDataToSignRequest = dtbsFromDigestRequest(request)
        const dssResponse = await this.dssClient.getDataToSign(dssRequest)
        if (dssResponse.isErr()) {
            throw dssResponse.error
        }

        const encodedDigest = ASN1.decode(Buffer.from(dssResponse.value.bytes, "base64"))
        const octetString = encodedDigest.sub![1].sub![1].sub![0]
        const messageDigest = ASNSchema.AsnParser.parse(Buffer.from(octetString.toB64String(), "base64"), MessageDigest)
        const documentHash = Buffer.from(new Uint8Array(messageDigest.buffer)).toString("base64")
        return { digest: documentHash } as IDigestPDFResponse
    }
}

function dtbsFromDigestRequest(dto: IDigestPDFRequest): IGetDataToSignRequest {
    return {
        toSignDocument: {
            bytes: dto.bytes
        },
        parameters: {
            digestAlgorithm: dto.digestAlgorithm,
            signatureLevel: ESignatureLevel.PAdES_B,
            generateTBSWithoutCertificate: true,
            blevelParams: {
                signingDate: dto.signingTimestamp ?? 0
            }
        }
    }
}

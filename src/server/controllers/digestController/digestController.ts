import { Base64 } from "../../../types/common"
import { Body, Controller, Post, Route } from "tsoa"
import * as Dss from "../../../dss"
import { dtbsFromDigestRequest, IDigestBlobRequest, IDigestBlobResponse, IDigestPDFRequest, IDigestPDFResponse } from "./types"
import { dssClient } from "../../../main" // HACK
import { IGetDataToSignRequest } from "../../../dss"
import ASN1 from "@lapo/asn1js"
import * as ASNSchema from "@peculiar/asn1-schema"

const id_messageDigest = "1.2.840.113549.1.9.4";

/**
 * ```asn
 * MessageDigest ::= OCTET STRING
 * ```
 */
class MessageDigest extends ASNSchema.OctetString { }

@Route("digest")
export class DigestController extends Controller {
    /**
     * Returns the base64 encoded digest of a base64 encoded sequence of bytes.
     */
    @Post("blob")
    public async digestBlob(@Body() body: IDigestBlobRequest): Promise<IDigestBlobResponse> {
        // TODO: Validate base64
        const requestData: Dss.IGetDataToSignRequest = {
            parameters: {
                signatureLevel: Dss.ESignatureLevel.XAdES_B,
                digestAlgorithm: body.digestAlgorithm,
                signaturePackaging: Dss.ESignaturePackaging.enveloping,
                generateTBSWithoutCertificate: true
            },
            toSignDocument: {
                bytes: body.bytes
            }
        }
        const getDataToSignRes = await dssClient.getDataToSign(requestData)
        if (getDataToSignRes.isErr()) {
            throw getDataToSignRes.error
        }
        const xmldsig = Buffer.from(getDataToSignRes.value.bytes, "base64").toString("utf8")
        const digest: Base64 = await Dss.getDigestValueFromXmldsig(xmldsig)
        const response: IDigestBlobResponse = { bytes: digest }
        return response
    }

    @Post("pdf")
    public async DigestPDF(@Body() request: IDigestPDFRequest): Promise<IDigestPDFResponse> {
        return await this.digestPDF(request)
    }

    private async digestPDF(request: IDigestPDFRequest): Promise<IDigestPDFResponse> {
        const DSSrequest: IGetDataToSignRequest = dtbsFromDigestRequest(request)
        const DSSReponse = await dssClient.getDataToSign(DSSrequest)
        if (DSSReponse.isErr()) {
            throw DSSReponse.error
        }

        const encodedDigest = ASN1.decode(Buffer.from(DSSReponse.value.bytes, "base64"))
        const octetString = encodedDigest.sub![1].sub![1].sub![0]
        const messageDigest = ASNSchema.AsnParser.parse(Buffer.from(octetString.toB64String(), "base64"), MessageDigest)
        const documentHash = Buffer.from(new Uint8Array(messageDigest.buffer)).toString("base64")
        return { bytes: documentHash }
    }
}

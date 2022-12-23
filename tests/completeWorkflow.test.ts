import { describe, test } from "mocha"
import * as Dss from "../src/dss/"
import { EDigestAlgorithm, ESignatureLevel, ESignaturePackaging, IGetDataToSignRequest } from "../src/dss/"
import { IDigestPDFRequest } from "../src/server/controllers/digestController"
import * as fs from "fs"
import { DigestFacade } from "../src/server/controllers/digestController/digestFacade"
import { centralServiceClient, exampleSignatureRequest } from "./centralServiceClient"

const dssBaseUrl = process.env.DSS_BASEURL ?? "http://127.0.0.1:8080"

describe(Dss.DssClient.name, () => {
    const dssClient = new Dss.DssClient(dssBaseUrl)
    before("Verify DSS is online", async () => {
        if ((await dssClient.isOnline()).isErr()) {
            throw new Error("DSS cannot be reached.")
        }
    })

    describe("run poc workflow", () => {
        test("happy path", async () => {
            const bytes = fs.readFileSync(`./unsigned.pdf`)
            getDataToSignRequest.base64 = bytes.toString('base64')
            const digestResponse = await new DigestFacade(dssClient).digestPDF(getDataToSignRequest)
            const digest = digestResponse.bytes

            const getsignedCMSRequest = exampleSignatureRequest
            getsignedCMSRequest.hash = digest
            const signature = await new centralServiceClient().getSignedCMS(getsignedCMSRequest)
            const cms = signature.
        })
    })
})

const getDataToSignRequest: IDigestPDFRequest = {
    base64: "",
    digestAlgorithm: EDigestAlgorithm.SHA256,
    signingTimestamp: 1670594222000
}
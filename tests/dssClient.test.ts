import { createHash } from "node:crypto"
import fs from "fs"
import { describe, test } from "mocha"
import { expect } from "chai"
import { DssClient } from "../src/dss/dssClient"
import { EDigestAlgorithm, ESignatureLevel, ESignaturePackaging, IGetDataToSignRequest } from "../src/dss/types"

const dssBaseUrl = process.env.DSS_BASEURL ?? "http://127.0.0.1:8080"

describe(DssClient.name, () => {
    const dssClient = new DssClient(dssBaseUrl)
    before("Verify DSS is online", async () => {
        if ((await dssClient.isOnline()).isErr()) {
            throw new Error("DSS cannot be reached.")
        }
    })

    describe("#getDataToSign()", () => {
        for (const filename of ["books.xml", "sheep.jpg"]) {
            test(`produces a correct SHA256 hash of '${filename}'`, async () => {
                const bytes = fs.readFileSync(`./tests/files/${filename}`)
                const requestData: IGetDataToSignRequest = {
                    parameters: {
                        signatureLevel: ESignatureLevel.XAdES_B,
                        digestAlgorithm: EDigestAlgorithm.SHA256,
                        signaturePackaging: ESignaturePackaging.enveloping,
                        generateTBSWithoutCertificate: true
                    },
                    toSignDocument: {
                        bytes: bytes.toString("base64")
                    }
                }
                const responseData = (await dssClient.getDataToSign(requestData))._unsafeUnwrap()
                const xmldsig = Buffer.from(responseData.bytes, "base64").toString("utf8")
                const have = await DssClient.getDigestValueFromXmldsig(xmldsig)
                const want = createHash("sha256").update(bytes).digest("base64")
                expect(have).to.equal(want)
            })
        }
    })
})

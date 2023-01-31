import { describe, test } from "mocha"
import { expect } from "chai"
import { makeCsClient, makeDssClient } from "./testsHelper"
import fs from "fs"
import { ApplicationService } from "../src/server/services"
import { DigestPDFRequest } from "../src/server/controllers/types"
import { EDigestAlgorithm } from "../src/types/common"
import { DssClient } from "../src/clients"
import { CsClient } from "../src/clients/cs"

describe("Digest Facade", () => {
    let dssClient: DssClient
    let csClient: CsClient
    before("Init", async () => {
        dssClient = await makeDssClient()
        csClient = await makeCsClient()
    })

    describe("/digest/pdf", () => {
        test("get the SHA256 digest of a pdf", async () => {
            const bytes = fs.readFileSync("./assets/unsigned.pdf")
            const request: DigestPDFRequest = {
                bytes: bytes.toString("base64"),
                digestAlgorithm: EDigestAlgorithm.SHA256,
                signingTimestamp: 1670594222000
            }
            const service = new ApplicationService(dssClient, csClient)
            const response = await service.createDigestForPDF(request) // TODO: DI
            const have = response._unsafeUnwrap().digest
            const want = "LKzqH/84VwE6BA10+ynTrB7jjNAliRRo7I2BUCukMXU="
            expect(have).to.equal(want)
        })
    })
})

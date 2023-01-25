import { describe, test } from "mocha"
import { expect } from "chai"
import { makeDssClient } from "./testsHelper"
import fs from "fs"
import { ApplicationService } from "../src/server/services"
import { IDocumentClient } from "../src/server/clients/IDocumentClient"
import { DigestPDFRequest } from "../src/server/controllers/types"
import { EDigestAlgorithm } from "../src/types/common"

describe("Digest Facade", () => {
    let dssClient: IDocumentClient
    before("Init", async () => {
        dssClient = await makeDssClient()
    })

    describe("/digest/pdf", () => {
        test("get the SHA256 digest of a pdf", async () => {
            const bytes = fs.readFileSync("./assets/unsigned.pdf")
            const request: DigestPDFRequest = {
                bytes: bytes.toString("base64"),
                digestAlgorithm: EDigestAlgorithm.SHA256,
                signingTimestamp: 1670594222000
            }
            const service = new ApplicationService(dssClient)
            const response = await service.createDigestForPDF(request) // TODO: DI
            const have = response._unsafeUnwrap().digest
            const want = "LKzqH/84VwE6BA10+ynTrB7jjNAliRRo7I2BUCukMXU="
            expect(have).to.equal(want)
        })
    })
})

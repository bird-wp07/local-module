import { describe, test } from "mocha"
import { expect } from "chai"
import { makeDssClient } from "./testsHelper"
import fs from "fs"
import * as service from "../src/server/controllers"
import * as Dss from "../src/dss"
import { IDigestPDFRequest } from "../src/server/controllers/types"

describe("Digest Facade", () => {
    let dssClient: Dss.DssClient
    before("Init", async () => {
        dssClient = await makeDssClient()
    })

    describe("/digest/pdf", () => {
        test(`get the SHA256 hash of a valid pdf`, async () => {
            const bytes = fs.readFileSync(`./assets/unsigned.pdf`)
            const request: IDigestPDFRequest = {
                base64: bytes.toString("base64"),
                digestAlgorithm: Dss.EDigestAlgorithm.SHA256,
                signingTimestamp: 1670594222000
            }
            const response = await new service.DigestFacade(dssClient).digestPDF(request) // TODO: DI
            const have = response.digest
            const want = "LKzqH/84VwE6BA10+ynTrB7jjNAliRRo7I2BUCukMXU="
            expect(have).to.equal(want)
        })
    })
})

import { describe, test } from "mocha"
import fs from "fs"
import * as service from "../src/server/controllers"
import * as Dss from "../src/dss/"
import { createHash } from "crypto"
import { expect } from "chai"
import { IDigestPDFRequest } from "../src/server/controllers/types"

const dssBaseUrl = process.env.DSS_BASEURL ?? "http://127.0.0.1:8080"

describe(Dss.DssClient.name, () => {
    const dssClient = new Dss.DssClient(dssBaseUrl)
    before("Verify DSS is online", async () => {
        if ((await dssClient.isOnline()).isErr()) {
            throw new Error("DSS cannot be reached.")
        }
    })

    describe("/digest/pdf", () => {
        test(`get the SHA256 hash of a valid pdf`, async () =>  {
            const bytes = fs.readFileSync(`./assets/unsigned.pdf`)
            const request: IDigestPDFRequest = {
                base64: bytes.toString('base64'),
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
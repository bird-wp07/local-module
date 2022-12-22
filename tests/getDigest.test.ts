import { describe, test } from "mocha"
import fs from "fs"
import {
    IDigestPDFRequest,
    DigestController
} from "../src/server/controllers/digestController"
import {
    EDigestAlgorithm
} from "../src/dss/types"
import * as Dss from "../src/dss/"
import { createHash } from "crypto"
import { expect } from "chai"
import { DigestFacade } from "../src/server/controllers/digestController/digestFacade"

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
                digestAlgorithm: EDigestAlgorithm.SHA256,
                signingTimestamp: 1670594222000
            }
            const response = await new DigestFacade(dssClient).digestPDF(request) // TODO: DI
            const have = response.bytes
            const want = "LKzqH/84VwE6BA10+ynTrB7jjNAliRRo7I2BUCukMXU="
            expect(have).to.equal(want)
        })
    })
})
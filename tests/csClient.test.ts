import { describe, test } from "mocha"
import { expect } from "chai"
import * as Cs from "../src/clients/cs"
import { makeCsClient } from "./testsHelper"

describe(Cs.CsClient.name, () => {
    let csClient: Cs.CsClient
    before("Init", async () => {
        csClient = await makeCsClient()
    })

    test.skip("TODO", () => {
        expect(csClient).to.equal(csClient)
    })
})

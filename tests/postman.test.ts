import { describe, test } from "mocha"
import { expect } from "chai"
import newman from "newman"
import { waitFor } from "wait-for-event"
import collection from "../postman.json"

const localModuleBaseUrl = process.env.LOCAL_MODULE_BASEURL ?? "http://localhost:2048"

describe("Postman", () => {
    test("Published collection successfully executes", async () => {
        let success = false
        const emitter = newman.run(
            {
                collection: collection,
                reporters: "cli",
                reporter: {
                    cli: {
                        silent: true // disables cli output
                    }
                },
                envVar: [{ key: "LOCAL_MODULE_BASEURL", value: localModuleBaseUrl }]
            },
            function (err, summary) {
                success = summary.run.failures.length === 0
            }
        )
        await waitFor("done", emitter)
        expect(success).to.be.true
    })
})

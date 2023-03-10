import * as fs from "fs"
import { describe, test } from "mocha"
import { expect } from "chai"

describe("Consistency checks", () => {
    test("Versions in package.json and openapi.json match", () => {
        /* eslint-disable */
        const packageJson = JSON.parse(fs.readFileSync("./package.json").toString("utf-8"))
        const openapiJson = JSON.parse(fs.readFileSync("./src/server/openapi.json").toString("utf-8"))
        expect(packageJson.version).to.be.equal(openapiJson.info.version)
        /* eslint-enable */
    })
})

import { describe, test } from "mocha"
import { expect } from "chai"
import * as Settings from "../src/settings"

describe(`Application settings parser`, () => {
    test(`accepts valid settings`, () => {
        const localModuleBaseUrls = ["http://localhost:2048", "http://localhost", "http://127.255.0.1:8192"]
        const dssBaseUrls = ["http://localhost:2214", "http://localhost", "http://127.255.0.1:8192"]
        const csBaseUrls = ["https://46.83.201.35.bc.googleusercontent.com"]

        for (let ii = 0; ii < localModuleBaseUrls.length; ii++) {
            const env = {
                WP07_LOCAL_MODULE_BASEURL: localModuleBaseUrls[ii],
                WP07_DSS_BASEURL: dssBaseUrls[ii],
                WP07_CS_BASEURL: csBaseUrls[ii]
            }
            const result = Settings.parseApplicationSettings(env)
            expect(result.isOk()).to.be.true
            const have = result._unsafeUnwrap()
            const want: Settings.IApplicationSettings = {
                localModuleBaseUrl: localModuleBaseUrls[ii],
                dssBaseUrl: dssBaseUrls[ii]
            }
            expect(have).to.deep.equal(want)
        }
    })
})

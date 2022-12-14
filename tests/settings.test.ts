import { describe, test } from "mocha"
import { expect } from "chai"
import * as Settings from "../src/settings"

describe(`Application settings parser`, () => {
    test(`accepts valid settings`, () => {
        const localModulePorts = ["8080", "2248", "2048", "80", "32768", "1234"]
        const dssBaseUrls = ["http://localhost:2214", "http://localhost", "https://localhost", "https://localhost:443", "http://127.255.0.1:8192", "https://192.168.178.22:12345"]

        for (let ii = 0; ii < localModulePorts.length; ii++) {
            const env = {
                WP07_LOCAL_MODULE_PORT: localModulePorts[ii],
                WP07_DSS_BASE_URL: dssBaseUrls[ii]
            }
            const result = Settings.parseApplicationSettings(env)
            expect(result.isOk()).to.be.true
            const have = result._unsafeUnwrap()
            const want = {
                localModuleUseHttps: false,
                localModuleIp: "localhost",
                localModulePort: Number(localModulePorts[ii]),
                dssBaseUrl: dssBaseUrls[ii]
            }
            expect(have).to.deep.equal(want)
        }
    })

    test(`rejects invalid local module ports`, () => {
        const localModulePorts = ["0", "99999", "-132", ":123"]
        const dssBaseUrls = ["http://localhost:2214", "https://localhost:443", "http://127.255.0.1:8192", "https://192.168.178.22:12345"]

        for (let ii = 0; ii < localModulePorts.length; ii++) {
            const env = {
                WP07_LOCAL_MODULE_PORT: localModulePorts[ii],
                WP07_DSS_BASE_URL: dssBaseUrls[ii]
            }
            const result = Settings.parseApplicationSettings(env)
            expect(result.isErr()).to.be.true
            const have = result._unsafeUnwrapErr()
            expect(have).to.be.instanceOf(Settings.Errors.InvalidEnvvarValue)
            expect((have as Settings.Errors.InvalidEnvvarValue).envvar).to.be.equal(Settings.localModulePortEnvvar)
            expect((have as Settings.Errors.InvalidEnvvarValue).value).to.be.equal(String(localModulePorts[ii]))
        }
    })

    test(`rejects invalid dss base urls`, () => {
        const localModulePorts = ["8080", "2048", "80", "32768"]
        const dssBaseUrls = ["unix:///run/user/1000/dss.sock", "file:///usr/local/share/foo.txt", "http://127.255.0.2.1", "https://192.168.178.22::12345"]

        for (let ii = 0; ii < localModulePorts.length; ii++) {
            const env = {
                WP07_LOCAL_MODULE_PORT: localModulePorts[ii],
                WP07_DSS_BASE_URL: dssBaseUrls[ii]
            }
            const result = Settings.parseApplicationSettings(env)
            expect(result.isErr()).to.be.true
            const have = result._unsafeUnwrapErr()
            expect(have).to.be.instanceOf(Settings.Errors.InvalidEnvvarValue)
            expect((have as Settings.Errors.InvalidEnvvarValue).envvar).to.be.equal(Settings.dssBaseUrlEnvvar)
            expect((have as Settings.Errors.InvalidEnvvarValue).value).to.be.equal(String(dssBaseUrls[ii]))
        }
    })
})

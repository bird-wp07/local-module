import { describe, test } from "mocha"
import { expect } from "chai"
import { Settings } from "../src/settings"

describe(`Application settings parser`, () => {
    test(`accepts valid addresses`, () => {
        const inputs = {
            localModuleIps: ["localhost", "127.0.0.1", "127.255.0.1", "192.168.178.22"],
            localModulePorts: [8080, 2048, 80, 32768],
            dssIps: ["localhost", "127.0.0.1", "127.255.0.1", "192.168.178.22"],
            dssPorts: [8080, 2048, 80, 32768]
        }

        for (let ii = 0; ii < inputs.localModuleIps.length; ii++) {
            const env = {
                WP07_LOCAL_MODULE_ADDRESS: `${inputs.localModuleIps[ii]}:${inputs.localModulePorts[ii]}`,
                WP07_DSS_ADDRESS: `${inputs.dssIps[ii]}:${inputs.dssPorts[ii]}`
            }
            const result = Settings.parseApplicationSettings(env)
            expect(result.isOk()).to.be.true
            const have = result._unsafeUnwrap()
            const want = {
                localModuleIp: inputs.localModuleIps[ii],
                localModulePort: inputs.localModulePorts[ii],
                dssIp: inputs.dssIps[ii],
                dssPort: inputs.dssPorts[ii]
            }
            expect(have).to.deep.equal(want)
        }
    })

    test(`rejects invalid addresses`, () => {
        const inputs = {
            localModuleIps: ["-foo.example.com", "_dnslink.ipfs.io", "Eins, zwei", "*Polizei.de"],
            localModulePorts: [80800, 0, -80, 32768.4],
            dssIps: ["-foo.example.com", "_dnslink.ipfs.io", "Eins, zwei", "*Polizei.de"],
            dssPorts: [80800, 0, -80, 32768.4],
        }

        for (let ii = 0; ii < inputs.localModuleIps.length; ii++) {
            const env = {
                WP07_LOCAL_MODULE_ADDRESS: `${inputs.localModuleIps[ii]}:${inputs.localModulePorts[ii]}`,
                WP07_DSS_ADDRESS: `${inputs.dssIps[ii]}:${inputs.dssPorts[ii]}`
            }
            const result = Settings.parseApplicationSettings(env)
            expect(result.isErr()).to.be.true
            const error = result._unsafeUnwrapErr()
            expect(error).to.be.instanceOf(Settings.Errors.InvalidSettings)
        }
    })
})

import { Settings } from "./settings"
import { Dss } from "./dss"
// import express from "express"

async function main() {
    /* Parse application settings. */
    const settingsRes = Settings.parseApplicationSettings()
    if (settingsRes.isErr()) {
        console.error(settingsRes.error.message)
        process.exit(1)
    }
    const settings = settingsRes.value

    const isOnline = await Dss.isOnline(settings.dssIp, settings.dssPort, { waitSeconds: 360 })
    if (isOnline) {
        console.log("OK")
    } else {
        console.log("Nope")
    }
}

main()
// const app = express()

// app.get("/", (_req, res) => {
//     res.send(`Local module v${process.env.npm_package_version}`)
// })

// app.listen(port, () => {
//     console.log(`Listening on port ${port}.`)
// })

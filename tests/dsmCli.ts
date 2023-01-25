/* eslint-disable */
import * as fs from "fs"
import { findLm, makeCsClient } from "./testsHelper"
import { httpReq } from "../src/utility"

async function main() {
    if (process.argv.length == 1) {
        console.error("No files provided. Abort.")
        process.exit(1)
    }
    // NOTE: The signing certificate used by the cs is valid
    //       from 2022-11-25T12:29:00Z to 2023-11-25T12:29:00Z
    const lmBaseUrl = await findLm()
    const csClient = await makeCsClient()
    const tempDirPath = `dsm-output-${new Date().toISOString()}`
    fs.mkdirSync(tempDirPath)
    console.log(`Files will be saved to '${tempDirPath}'`)

    for (const pdfpath of process.argv.slice(2)) {
        console.log(`    Processing file '${pdfpath}'`)
        const timestampMs = Number(new Date("2022-11-26T12:00:00Z"))
        const pdfBase64 = fs.readFileSync(pdfpath).toString("base64")
        const resDigest = await httpReq({
            method: "POST",
            baseURL: lmBaseUrl,
            url: "/digest/pdf",
            data: {
                digestAlgorithm: "SHA256",
                bytes: pdfBase64,
                signingTimestamp: timestampMs
            }
        })
        if (resDigest.isErr()) {
            console.error(`Digest failed for file '${pdfpath}':\n${JSON.stringify((resDigest as any).error.response.data, null, 4)}`)
            process.exit(1)
        }
        const digest = resDigest.value.data.digest

        const resSign = await httpReq({
            method: "POST",
            baseURL: csClient.baseUrl,
            url: "/api/v1/signer/issuances",
            data: {
                auditLog: "Signing of TestDocument",
                issuerId: "ID-OF-YOUR-KEY",
                hash: digest,
                digestMethod: "SHA256"
            }
        })
        if (resSign.isErr()) {
            console.error(`Signature generation failed for file '${pdfpath}'.`)
            process.exit(1)
        }
        const cms = resSign.value.data.cms

        const resMerge = await httpReq({
            method: "POST",
            baseURL: lmBaseUrl,
            url: "/merge/pdf",
            data: {
                bytes: pdfBase64,
                signatureAsCMS: cms,
                signingTimestamp: timestampMs
            }
        })
        if (resMerge.isErr()) {
            console.error(`Merging failed for file '${pdfpath}'\n${JSON.stringify((resMerge as any).error.response.data, null, 4)}`)
            process.exit(1)
        }
        const signedPdf = resMerge.value.data.bytes

        const fileName = pdfpath.match(/[^/]+$/)![0]
        fs.writeFileSync(`${tempDirPath}/signed-${fileName}`, signedPdf, "base64")
    }
    console.log("Done.")
    /* eslint-enable */
}

void main()

import { describe, test } from "mocha"
import * as Dss from "../src/dss/"
import * as fs from "fs"
import { centralServiceClient, ISignatureRequest } from "./centralServiceClient"
import * as service from "../src/server/controllers"
import { expect } from "chai"
import { IDigestPDFRequest, IMergePDFRequest, IValidateSignedPdfRequest, IValidateSignedPdfResponse } from "../src/server/controllers/types"

const dssBaseUrl = process.env.DSS_BASEURL ?? "http://127.0.0.1:8080"

describe(Dss.DssClient.name, () => {
    const dssClient = new Dss.DssClient(dssBaseUrl)
    before("Verify DSS is online", async () => {
        if ((await dssClient.isOnline()).isErr()) {
            throw new Error("DSS cannot be reached.")
        }
    })

    describe("run poc workflow", () => {
        test("happy path", async () => {
            const base64PDF = fs.readFileSync(`./tests/unsigned.pdf`).toString('base64')
            getDataToSignRequest.base64 = base64PDF
            const digestResponse = await new service.DigestFacade(dssClient).digestPDF(getDataToSignRequest)
            const digest = digestResponse.digest

            const getsignedCMSRequest = exampleSignatureRequest
            getsignedCMSRequest.hash = digest
            const signature = await new centralServiceClient().getSignedCMS(getsignedCMSRequest)
            if (signature.isErr()) {
                throw signature.error
            }
            const cms = signature.value.cms.toString()

            getSignedDocumentRequest.base64 = base64PDF
            getSignedDocumentRequest.signatureAsCMS = cms
            const signedPDF = await new service.MergeFacade(dssClient).mergePDF(getSignedDocumentRequest)

            validateSignedPDFRequest.base64 = signedPDF.base64
            const validationResult = await new service.ValidateFacade(dssClient).validateSignature(validateSignedPDFRequest)
            const have = validationResult
            const want: IValidateSignedPdfResponse = {
                result: Dss.ESignatureValidationIndication.INDETERMINATE,
                reason: Dss.ESignatureValidationSubIndication.NO_CERTIFICATE_CHAIN_FOUND
            }
            expect(have).to.deep.equal(want)
        })
    })
})

const signatureTimestamp: number = 1670594222000

const getDataToSignRequest: IDigestPDFRequest = {
    base64: "",
    digestAlgorithm: Dss.EDigestAlgorithm.SHA256,
    signingTimestamp: signatureTimestamp
}

const exampleSignatureRequest: ISignatureRequest = {
    auditLog: "Signing of Test Document",
    issuerId: "ID-OF-YOUR-KEY",
    hash: "toBeInserted",
    digestMethod: "SHA256"
}

const getSignedDocumentRequest: IMergePDFRequest = {
    base64: "toBeInserted",
    signatureAsCMS: "toBeInserted",
    signingTimestamp: signatureTimestamp
}

const validateSignedPDFRequest: IValidateSignedPdfRequest = {
    base64: "toBeInserted"
}
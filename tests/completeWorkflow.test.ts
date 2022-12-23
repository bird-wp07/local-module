import { describe, test } from "mocha"
import * as Dss from "../src/dss/"
import { EDigestAlgorithm, ESignatureLevel, ESignaturePackaging, ESignatureValidationIndication, ESignatureValidationSubIndication, IGetDataToSignRequest, IValidateSignatureRequest } from "../src/dss/"
import { IDigestPDFRequest } from "../src/server/controllers/digestController"
import * as fs from "fs"
import { DigestFacade } from "../src/server/controllers/digestController/digestFacade"
import { centralServiceClient, ISignatureRequest } from "./centralServiceClient"
import { IMergePDFRequest } from "../src/server/controllers/types"
import { MergeFacade } from "../src/server/controllers/mergeController/mergeFacade"
import { IValidateSignedPdfRequest, IValidateSignedPdfResponse } from "../src/server/controllers/validateController"
import { ValidateFacade } from "../src/server/controllers/validateController/validateFacade"
import { ValidateError } from "tsoa"
import { expect } from "chai"

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
            const digestResponse = await new DigestFacade(dssClient).digestPDF(getDataToSignRequest)
            const digest = digestResponse.bytes

            const getsignedCMSRequest = exampleSignatureRequest
            getsignedCMSRequest.hash = digest
            const signature = await new centralServiceClient().getSignedCMS(getsignedCMSRequest)
            if (signature.isErr()) {
                throw signature.error
            }
            const cms = signature.value.cms.toString()

            getSignedDocumentRequest.bytes = base64PDF
            getSignedDocumentRequest.signatureAsCMS = cms
            const signedPDF = await new MergeFacade(dssClient).mergePDF(getSignedDocumentRequest)

            validateSignedPDFRequest.bytes = signedPDF.bytes
            const validationResult = await new ValidateFacade(dssClient).validateSignature(validateSignedPDFRequest)
            const have = validationResult
            const want: IValidateSignedPdfResponse = {
                result: ESignatureValidationIndication.INDETERMINATE,
                reason: ESignatureValidationSubIndication.NO_CERTIFICATE_CHAIN_FOUND
            }
            expect(have).to.deep.equal(want)
        })
    })
})

const signatureTimestamp: number = 1670594222000

const getDataToSignRequest: IDigestPDFRequest = {
    base64: "",
    digestAlgorithm: EDigestAlgorithm.SHA256,
    signingTimestamp: signatureTimestamp
}

const exampleSignatureRequest: ISignatureRequest = {
    auditLog: "Signing of Test Document",
    issuerId: "ID-OF-YOUR-KEY",
    hash: "toBeInserted",
    digestMethod: "SHA256"
}

const getSignedDocumentRequest: IMergePDFRequest = {
    bytes: "toBeInserted",
    signatureAsCMS: "toBeInserted",
    timestamp: signatureTimestamp
}

const validateSignedPDFRequest: IValidateSignedPdfRequest = {
    bytes: "toBeInserted"
}
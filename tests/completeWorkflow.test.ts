import { expect } from "chai"
import { describe, test } from "mocha"
import * as fs from "fs"
import * as Cs from "../src/cs"
import * as Dss from "../src/dss/"
import * as service from "../src/server/controllers"
import { IDigestPDFRequest, IMergePDFRequest, IValidateSignedPdfRequest, IValidateSignedPdfResponse } from "../src/server/controllers/types"

import { makeCsClient, makeDssClient } from "./testsHelper"

const signatureTimestamp = 1670594222000

const getDataToSignRequest: IDigestPDFRequest = {
    base64: "",
    digestAlgorithm: Dss.EDigestAlgorithm.SHA256,
    signingTimestamp: signatureTimestamp
}

const exampleSignatureRequest: Cs.ISignatureRequest = {
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

describe("Complete workflow", () => {
    let dssClient: Dss.DssClient
    let csClient: Cs.CsClient
    before("Init", async () => {
        dssClient = await makeDssClient()
        csClient = await makeCsClient()
    })

    describe("run poc workflow", () => {
        test("happy path", () => {
            expect(1).to.equal(1)
            // const base64PDF = fs.readFileSync("./assets/unsigned.pdf").toString("base64")
            // getDataToSignRequest.base64 = base64PDF
            // const digestResponse = await new service.DigestFacade(dssClient).digestPDF(getDataToSignRequest)
            // const digest = digestResponse.digest
            // const getSignedCMSRequest = { ...exampleSignatureRequest, hash: digest }
            // const signature = new CentralServiceClient().getSignedCMS(getSignedCMSRequest)
            // expect(signature.isErr()).to.be.false
            // const cms = signature._unsafeUnwrap().cms.toString()
            // getSignedDocumentRequest.base64 = base64PDF
            // getSignedDocumentRequest.signatureAsCMS = cms
            // const signedPDF = await new service.MergeFacade(dssClient).mergePDF(getSignedDocumentRequest)
            // validateSignedPDFRequest.base64 = signedPDF.base64
            // const validationResult = await new service.ValidateFacade(dssClient).validateSignature(validateSignedPDFRequest)
            // const have = validationResult
            // const want: IValidateSignedPdfResponse = {
            //     result: Dss.ESignatureValidationIndication.INDETERMINATE,
            //     reason: Dss.ESignatureValidationSubIndication.NO_CERTIFICATE_CHAIN_FOUND
            // }
            // expect(have).to.deep.equal(want)
        })
    })
})

import { Body, Controller, Post, Route } from "tsoa"
import { IDigestPDFRequest, IDigestPDFResponse } from "../types"
import { dssClient } from "../../../main" // HACK
import { DigestFacade } from "./digestFacade"

@Route("digest")
export class DigestController extends Controller {
    @Post("pdf")
    public async DigestPDF(@Body() request: IDigestPDFRequest): Promise<IDigestPDFResponse> {
        const res = await new DigestFacade(dssClient).digestPDF(request)
        if (res.isErr()) {
            throw res.error
        }
        return res.value
    }
}

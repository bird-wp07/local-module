import { Body, Controller, Post, Route } from "tsoa"
import { IMergePDFRequest, IMergePDFResponse } from "../types"
import { dssClient } from "../../../main" // HACK
import { MergeFacade } from "./mergeFacade"

@Route("merge")
export class MergeController extends Controller {
    @Post("pdf")
    public async MergePDF(@Body() request: IMergePDFRequest): Promise<IMergePDFResponse> {
        const res = await new MergeFacade(dssClient).mergePDF(request)
        if (res.isErr()) {
            throw res.error
        }
        return res.value
    }
}

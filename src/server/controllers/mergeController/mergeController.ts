import { Base64 } from "../../../types/common"
import { Body, Controller, Post, Route } from "tsoa"
import * as Dss from "../../../dss"
import { IDigestBlobRequest, IDigestBlobResponse, IDigestPDFRequest, IDigestPDFResponse, IMergePDFRequest, IMergePDFResponse } from "../types"
import { dssClient } from "../../../main" // HACK
import { CMS2DSS, DSSParams } from "../../../utility"
import { MergeFacade } from "./mergeFacade"

@Route("merge")
export class MergeController extends Controller {
    @Post("pdf")
    public async MergePDF(@Body() request: IMergePDFRequest): Promise<IMergePDFResponse> {
        // FIXME: Bogus implementation
        return await new MergeFacade(dssClient).mergePDF(request)
    }
}

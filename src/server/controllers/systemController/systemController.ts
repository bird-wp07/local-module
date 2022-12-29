import { Controller, Get, Route } from "tsoa"
import { IGetHealthResponse } from "../types"

@Route("system")
export class SystemController extends Controller {
    /**
     * Returns the base64 encoded digest of a base64 encoded sequence of bytes.
     */
    @Get("health")
    public getHealth(): IGetHealthResponse {
        const result: IGetHealthResponse = { status: "ok" }
        return result
    }
}

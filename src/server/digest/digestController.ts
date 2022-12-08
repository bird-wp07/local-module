// import { Body, Controller, Post, Route } from "tsoa";
// import { DigestFacade } from "./digestFacade";
// import { IDigestRequest, IDigestResponse } from "./types";

// @Route("digest")
// export class DigestController extends Controller {
//     @Post("xml")
//     public async DigestXML(@Body() digestRequest: IDigestRequest): Promise<IDigestResponse> {
//         const digest = await new DigestFacade().CreateDigest(digestRequest)
//         return digest
//     }

//     @Post("pdf")
//     public async DigestPDF(@Body() digestRequest: IDigestRequest): Promise<IDigestResponse> {
//         const digest = await new DigestFacade().CreateDigest(digestRequest)
//         return digest
//     }
// }

import * as Express from "express"
import * as Joi from "joi"
import { EDigestAlgorithm, IDigestPDFRequest, RequestValidationError, RequestBodyTooLarge, UnhandledError, Schema_IDigestPDFRequest } from "./types"
import { Logic } from "./logic"
import { Container, Inject } from "typescript-ioc"

export const HTTP_MAX_REQUEST_BODY_SIZE_BYTES = 8000000

export class Server {
    private _expressApp: Express.Express

    constructor(@Inject private logic: Logic) {
        this.logic = logic

        this._expressApp = Express.default()
        // this._expressApp.use(Express.urlencoded({ extended: true }))
        this._expressApp.use(Express.json({ limit: HTTP_MAX_REQUEST_BODY_SIZE_BYTES }))

        /* eslint-disable-next-line -- unused variables req, next*/
        this._expressApp.use((err: Error, req: Express.Request, res: Express.Response, next: Express.NextFunction) => {
            /* Syntax errors arise if we're given invalid json bodies. */
            if (err instanceof SyntaxError && (err as any).type === "entity.parse.failed") {
                return res.status(422).json(new RequestValidationError("invalid json"))
            }

            // TODO: Where is PayloadTooLargeError defined?
            //       Debugger shows that an error named PayloadTooLargeError is
            //       emitted. However, I can't find out where this type is defined
            //       or where the object is constructed. Thus, we rely on comparing
            //       the error message.
            if (err.message === "request entity too large") {
                return res.status(400).json(new RequestBodyTooLarge())
            }

            return res.status(400).json(new UnhandledError(err))
        })

        this._expressApp.get("/system/health", this.healthController)
        this._expressApp.post("/digest/pdf", this.digestPdfController)
    }

    public healthController: Express.RequestHandler = async (req, res): Promise<Express.Response> => {
        const response = await this.logic.health()
        return res.status(200).json({
            ok: response
        })
    }

    public digestPdfController: Express.RequestHandler = async (req, res): Promise<Express.Response> => {
        const validationResponse = Schema_IDigestPDFRequest.validate(req.body)
        if (validationResponse.error !== undefined) {
            return res.status(422).json(new RequestValidationError(validationResponse.error.details))
        }

        const response = await this.logic.digestPdf(req.body as IDigestPDFRequest)
        if (response.isErr()) {
            return res.status(400).json({
                error: JSON.stringify(response.error)
            })
        }
        return res.status(200).json({
            bytes: response.value.bytes
        })
    }

    public get expressApp() {
        return this._expressApp
    }
}

// export function makeApp(): Express.Express {
//     const logic = Container.get(Logic)

//     const healthHandler = (async (req, res): Promise<Express.Response> => {
//         const response = await logic.health()
//         return res.status(200).json({
//             ok: response
//         })
//     }) as Express.RequestHandler

//     const app = Express.default()

//     app.use(Express.urlencoded({ extended: true }))
//     app.use(Express.json({ limit: HTTP_MAX_PAYLOAD_SIZE_BYTES }))

//     app.get("/system/health", healthHandler)

//     for (const route of Object.keys(routeCfg)) {
//         app.post(routeCfg[route].path, (req, res) => {
//             /* Configure validation. */
//             const valRes = routeCfg[route].validationSchema.validate(req.body)
//             if (valRes.error !== undefined) {
//                 return res.status(422).json({
//                     code: "VALIDATION_REQUEST",
//                     message: "Invalid json in request body",
//                     details: valRes.error.details
//                 })
//             }

//             return
//         })
//     }

//     return app
// }

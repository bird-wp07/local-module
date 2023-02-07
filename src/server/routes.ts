import * as Express from "express"
import * as Joi from "joi"
import {
    IDigestPdfRequest,
    RequestValidationError,
    RequestBodyTooLarge,
    IValidateSignedPdfRequest,
    Schema_IValidateSignedPdfRequest,
    Schema_IDigestPdfRequest,
    ProcessingRequestError
} from "./types"
import { Logic } from "./logic"
import { Container } from "typescript-ioc"

export const HTTP_MAX_REQUEST_BODY_SIZE_BYTES = 8000000

function makeHealthController(impl: Logic): Express.RequestHandler {
    const fn = async (req: Express.Request, res: Express.Response): Promise<Express.Response> => {
        const response = await impl.health()
        return res.status(200).json({
            ok: response
        })
    }
    return fn as Express.RequestHandler
}

function makeDigestController(impl: Logic): Express.RequestHandler {
    const fn = async (req: Express.Request, res: Express.Response, next: Express.NextFunction): Promise<Express.Response | any> => {
        const validationResponse = Schema_IDigestPdfRequest.validate(req.body)
        if (validationResponse.error !== undefined) {
            return next(validationResponse.error)
        }

        const response = await impl.digestPdf(req.body as IDigestPdfRequest)
        if (response.isErr()) {
            return next(response.error)
        }

        return res.status(200).json({
            bytes: response.value.bytes
        })
    }
    return fn as Express.RequestHandler
}

function makeValidationController(impl: Logic): Express.RequestHandler {
    const fn = async (req: Express.Request, res: Express.Response, next: Express.NextFunction): Promise<Express.Response | any> => {
        const validationResponse = Schema_IValidateSignedPdfRequest.validate(req.body)
        if (validationResponse.error !== undefined) {
            return next(validationResponse.error)
        }

        const response = await impl.validateSignedPdf(req.body as IValidateSignedPdfRequest)
        if (response.isErr()) {
            return next(response.error)
        }
        return res.status(200).json(response.value)
    }
    return fn as Express.RequestHandler
}

/**
 * Maps errors occurring during processing of requests to our own,
 * outside-facing errors.
 */
// eslint-disable-next-line -- HACK: don't delete the 'next' arg, or else express will make a RequestHandler() out of this.
const errorHandler: Express.ErrorRequestHandler = (err: Error, _: Express.Request, res: Express.Response, next: Express.NextFunction) => {
    /* Process validation errors due to joi schema mismatch of valid json bodies. */
    if (err instanceof Joi.ValidationError) {
        return res.status(400).json(new RequestValidationError(err.details))
    }

    /* Process syntax errors due to invalid json in the request bodies. */
    if (err instanceof SyntaxError && (err as any).type === "entity.parse.failed") {
        return res.status(400).json(new RequestValidationError("invalid json"))
    }

    /* Process errors due to excessively large request bodies. */
    if (err.message === "request entity too large") {
        // TODO: Where is PayloadTooLargeError defined?
        //       Debugger shows that an error named PayloadTooLargeError is
        //       emitted. However, I can't find out where this type is defined
        //       or where the object is constructed. Thus, we rely on comparing
        //       the error message.
        return res.status(400).json(new RequestBodyTooLarge())
    }

    /* Default error indicating. */
    return res.status(400).json(new ProcessingRequestError(err))
}

export function makeApp(): Express.Express {
    const logic = Container.get(Logic)

    const app = Express.default()
    // _expressApp.use(Express.urlencoded({ extended: true }))
    app.use(Express.json({ limit: HTTP_MAX_REQUEST_BODY_SIZE_BYTES }))

    app.get("/system/health", makeHealthController(logic))
    app.post("/digest/pdf", makeDigestController(logic))
    app.post("/validate/pdf", makeValidationController(logic)) // TODO: use nouns consistently; validate -> validation

    app.use(errorHandler)

    return app
}

import * as Express from "express"
import swaggerExpress from "swagger-ui-express"
import swaggerDocument from "./openapi.json"
import * as Joi from "joi"
import {
    IDigestPdfRequest,
    RequestValidationError,
    RequestBodyTooLarge,
    IValidateSignedPdfRequest,
    Schema_IValidateSignedPdfRequest,
    Schema_IDigestPdfRequest,
    ProcessingRequestError,
    Schema_IMergePdfRequest,
    IMergePdfRequest,
    IDigestPdfResponse,
    IMergePdfResponse,
    IValidateSignedPdfResponse,
    Schema_IIssueRequest,
    IIssueRequest,
    IIssueResponse,
    Schema_ISignPdfRequest,
    ISignPdfRequest,
    ISignPdfResponse
} from "./types"
import { IAppLogic } from "../applogic/base"
import { Container } from "typescript-ioc"
import { Base64 } from "../utility"

export const HTTP_MAX_REQUEST_BODY_SIZE_BYTES = 8000000
export const swaggerUiPath = "/swagger"

function makeHealthController(impl: IAppLogic): Express.RequestHandler {
    const fn = async (req: Express.Request, res: Express.Response, next: Express.NextFunction): Promise<Express.Response | any> => {
        const response = await impl.health()
        if (response.isErr()) {
            return next(response.error)
        }
        return res.status(200).json(response.value)
    }
    return fn as Express.RequestHandler
}

function makeDigestController(impl: IAppLogic): Express.RequestHandler {
    const fn = async (req: Express.Request, res: Express.Response, next: Express.NextFunction): Promise<Express.Response | any> => {
        /* Validate incoming request. */
        const validationResponse = Schema_IDigestPdfRequest.validate(req.body)
        if (validationResponse.error !== undefined) {
            return next(validationResponse.error)
        }
        const body = req.body as IDigestPdfRequest

        /* Call implementation. */
        const pdf = body.bytes
        const timestamp = new Date(body.signingTimestamp)
        const response = await impl.generatePdfDigestToBeSigned(pdf, timestamp)
        if (response.isErr()) {
            return next(response.error)
        }
        const responseBody: IDigestPdfResponse = {
            bytes: response.value
        }
        return res.status(200).json(responseBody)
    }
    return fn as Express.RequestHandler
}

function makeIssueController(impl: IAppLogic): Express.RequestHandler {
    const fn = async (req: Express.Request, res: Express.Response, next: Express.NextFunction): Promise<Express.Response | any> => {
        /* Validate incoming request. */
        const validationResponse = Schema_IIssueRequest.validate(req.body)
        if (validationResponse.error !== undefined) {
            return next(validationResponse.error)
        }
        const body = req.body as IIssueRequest

        /* Call implementation. */
        const digestToBeSigned = body.bytes
        const issuerId = body.issuerId
        const auditLog = body.auditLog
        const response = await impl.issueSignature(digestToBeSigned, issuerId, auditLog)
        if (response.isErr()) {
            return next(response.error)
        }
        const responseBody: IIssueResponse = {
            cms: response.value
        }
        return res.status(200).json(responseBody)
    }
    return fn as Express.RequestHandler
}

function makeMergeController(impl: IAppLogic): Express.RequestHandler {
    const fn = async (req: Express.Request, res: Express.Response, next: Express.NextFunction): Promise<Express.Response | any> => {
        /* Validate incoming request. */
        const validationResponse = Schema_IMergePdfRequest.validate(req.body)
        if (validationResponse.error !== undefined) {
            return next(validationResponse.error)
        }
        const body = req.body as IMergePdfRequest

        /* Call implementation. */
        const pdf = body.bytes
        const timestamp = new Date(body.signingTimestamp)
        const cms = body.cms
        const response = await impl.embedSignatureIntoPdf(pdf, timestamp, cms)
        if (response.isErr()) {
            return next(response.error)
        }
        const responseBody: IMergePdfResponse = {
            bytes: response.value
        }
        return res.status(200).json(responseBody)
    }
    return fn as Express.RequestHandler
}

function makeValidationController(impl: IAppLogic): Express.RequestHandler {
    const fn = async (req: Express.Request, res: Express.Response, next: Express.NextFunction): Promise<Express.Response | any> => {
        /* Validate incoming request. */
        const validationResponse = Schema_IValidateSignedPdfRequest.validate(req.body)
        if (validationResponse.error !== undefined) {
            return next(validationResponse.error)
        }
        const body = req.body as IValidateSignedPdfRequest

        /* Call implementation. */
        const pdf = body.bytes
        const response = await impl.validateSignedPdf(pdf)
        if (response.isErr()) {
            return next(response.error)
        }
        const responseBody: IValidateSignedPdfResponse = response.value
        return res.status(200).json(responseBody)
    }
    return fn as Express.RequestHandler
}

function makeSignController(impl: IAppLogic): Express.RequestHandler {
    const fn = async (req: Express.Request, res: Express.Response, next: Express.NextFunction): Promise<Express.Response | any> => {
        /* Validate incoming request. */
        const validationResponse = Schema_ISignPdfRequest.validate(req.body)
        if (validationResponse.error !== undefined) {
            return next(validationResponse.error)
        }
        const body = req.body as ISignPdfRequest
        const pdf = body.bytes
        const issuerId = body.issuerId
        const timestamp = new Date()

        /* Digest */
        const resultDigest = await impl.generatePdfDigestToBeSigned(pdf, timestamp)
        if (resultDigest.isErr()) {
            return next(resultDigest.error)
        }
        const digestToBeSigned: Base64 = resultDigest.value

        /* Issue */
        const resultIssue = await impl.issueSignature(digestToBeSigned, issuerId)
        if (resultIssue.isErr()) {
            return next(resultIssue.error)
        }
        const cms: Base64 = resultIssue.value

        /* Merge */
        const resultMerge = await impl.embedSignatureIntoPdf(pdf, timestamp, cms)
        if (resultMerge.isErr()) {
            return next(resultMerge.error)
        }
        const signedPdf: Base64 = resultMerge.value

        const responseBody: ISignPdfResponse = {
            bytes: signedPdf
        }
        return res.status(200).json(responseBody)
    }
    return fn as Express.RequestHandler
}

/**
 * Maps errors occurring during processing of requests to our own,
 * outside-facing errors.
 */
// eslint-disable-next-line -- HACK: don't delete the 'next' arg, or express will make a RequestHandler() out of this.
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
    const impl = Container.get(IAppLogic)

    const app = Express.default()
    // _expressApp.use(Express.urlencoded({ extended: true })) TODO: Do we need this?
    app.use(Express.json({ limit: HTTP_MAX_REQUEST_BODY_SIZE_BYTES }))
    app.use(swaggerUiPath, swaggerExpress.serve, swaggerExpress.setup(swaggerDocument))

    app.get("/system/health", makeHealthController(impl))
    app.post("/digest/pdf", makeDigestController(impl))
    app.post("/issue", makeIssueController(impl))
    app.post("/merge/pdf", makeMergeController(impl))
    app.post("/validate/pdf", makeValidationController(impl))
    app.post("/sign/pdf", makeSignController(impl))

    app.use(errorHandler)

    return app
}

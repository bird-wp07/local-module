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
    ISignPdfResponse,
    IHealthResponse,
    EHealthStatus,
    IRevocationRequest,
    Schema_IRevocationRequest,
    IRevocationResponse
} from "./types"
import * as Applogic from "../applogic"
import { Container } from "typescript-ioc"
import { Base64 } from "../utility"
import { logger } from "../settings"

export const HTTP_MAX_REQUEST_BODY_SIZE_BYTES = 8000000
export const swaggerUiPath = "/swagger"

function makeHealthController(impl: Applogic.IAppLogic): Express.RequestHandler {
    const fn = async (req: Express.Request, res: Express.Response, next: Express.NextFunction): Promise<Express.Response | any> => {
        const rsltHealth = await impl.health()
        if (rsltHealth.isErr()) {
            return next(rsltHealth.error)
        }
        const health: Applogic.IHealthStatus = rsltHealth.value

        const response: IHealthResponse = {
            status: health.ok ? EHealthStatus.OK : EHealthStatus.ERROR,
            details: health.details as unknown
        }
        return res.status(200).json(response)
    }
    return fn as Express.RequestHandler
}

function makeDigestController(impl: Applogic.IAppLogic): Express.RequestHandler {
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
        const rsltGenerateDtbs = await impl.generatePdfDigestToBeSigned(pdf, timestamp)
        if (rsltGenerateDtbs.isErr()) {
            return next(rsltGenerateDtbs.error)
        }
        const responseBody: IDigestPdfResponse = {
            bytes: rsltGenerateDtbs.value
        }
        return res.status(200).json(responseBody)
    }
    return fn as Express.RequestHandler
}

function makeIssueController(impl: Applogic.IAppLogic): Express.RequestHandler {
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
        const rsltIssueSignature = await impl.issueSignature(digestToBeSigned, issuerId, auditLog)
        if (rsltIssueSignature.isErr()) {
            return next(rsltIssueSignature.error)
        }
        const responseBody: IIssueResponse = {
            cms: rsltIssueSignature.value.cms,
            signatureValueDigest: rsltIssueSignature.value.signatureValueDigest
        }
        return res.status(200).json(responseBody)
    }
    return fn as Express.RequestHandler
}

function makeMergeController(impl: Applogic.IAppLogic): Express.RequestHandler {
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
        const rsltEmbedSignatureIntoPdf = await impl.embedSignatureIntoPdf(pdf, timestamp, cms)
        if (rsltEmbedSignatureIntoPdf.isErr()) {
            return next(rsltEmbedSignatureIntoPdf.error)
        }
        const responseBody: IMergePdfResponse = {
            bytes: rsltEmbedSignatureIntoPdf.value
        }
        return res.status(200).json(responseBody)
    }
    return fn as Express.RequestHandler
}

function makeValidationController(impl: Applogic.IAppLogic): Express.RequestHandler {
    const fn = async (req: Express.Request, res: Express.Response, next: Express.NextFunction): Promise<Express.Response | any> => {
        /* Validate incoming request. */
        const validationResponse = Schema_IValidateSignedPdfRequest.validate(req.body)
        if (validationResponse.error !== undefined) {
            return next(validationResponse.error)
        }
        const body = req.body as IValidateSignedPdfRequest

        /* Call implementation. */
        const pdf = body.bytes
        const rsltValidateSignedPdf = await impl.validateSignedPdf(pdf)
        if (rsltValidateSignedPdf.isErr()) {
            return next(rsltValidateSignedPdf.error)
        }
        const responseBody: IValidateSignedPdfResponse = rsltValidateSignedPdf.value
        return res.status(200).json(responseBody)
    }
    return fn as Express.RequestHandler
}

function makeRevokeController(impl: Applogic.IAppLogic): Express.RequestHandler {
    const fn = async (req: Express.Request, res: Express.Response, next: Express.NextFunction): Promise<Express.Response | any> => {
        /* Validate incoming request. */
        const validationResponse = Schema_IRevocationRequest.validate(req.body)
        if (validationResponse.error !== undefined) {
            return next(validationResponse.error)
        }
        const body = req.body as IRevocationRequest

        /* Call implementation. */
        const signatureValueDigest = body.signatureValueDigest
        const reason = body.reason
        const rsltRevokeSignature = await impl.revokeSignature(signatureValueDigest, reason)
        if (rsltRevokeSignature.isErr()) {
            return next(rsltRevokeSignature.error)
        }
        const responseBody: IRevocationResponse = rsltRevokeSignature.value
        return res.status(200).json(responseBody)
    }
    return fn as Express.RequestHandler
}

function makeSignController(impl: Applogic.IAppLogic): Express.RequestHandler {
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
        const rsltGenerateDbts = await impl.generatePdfDigestToBeSigned(pdf, timestamp)
        if (rsltGenerateDbts.isErr()) {
            return next(rsltGenerateDbts.error)
        }
        const digestToBeSigned: Base64 = rsltGenerateDbts.value

        /* Issue */
        const rsltIssueSignature = await impl.issueSignature(digestToBeSigned, issuerId)
        if (rsltIssueSignature.isErr()) {
            return next(rsltIssueSignature.error)
        }
        const issueSignatureResponse: Applogic.IIssueSignatureResponse = rsltIssueSignature.value

        /* Merge */
        const rsltEmbedSignature = await impl.embedSignatureIntoPdf(pdf, timestamp, issueSignatureResponse.cms)
        if (rsltEmbedSignature.isErr()) {
            return next(rsltEmbedSignature.error)
        }
        const signedPdf: Base64 = rsltEmbedSignature.value

        const responseBody: ISignPdfResponse = {
            bytes: signedPdf,
            signatureValueDigest: rsltIssueSignature.value.signatureValueDigest
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
    logger.debug(JSON.stringify(err))

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

export function makeApp(exposeSecuredRoutes = true): Express.Express {
    const impl = Container.get(Applogic.IAppLogic)

    const app = Express.default()
    app.use(Express.json({ limit: HTTP_MAX_REQUEST_BODY_SIZE_BYTES }))
    app.use(swaggerUiPath, swaggerExpress.serve, swaggerExpress.setup(swaggerDocument))

    app.get("/system/health", makeHealthController(impl))
    app.post("/digest/pdf", makeDigestController(impl))
    app.post("/merge/pdf", makeMergeController(impl))
    app.post("/validate/pdf", makeValidationController(impl))
    if (exposeSecuredRoutes) {
        app.post("/issue", makeIssueController(impl))
        app.post("/revoke", makeRevokeController(impl))
        app.post("/sign/pdf", makeSignController(impl))
    }

    // TODO: Expose pretty error for undefined routes
    app.use(errorHandler)

    return app
}

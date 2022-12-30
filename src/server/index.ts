import { ValidateError } from "tsoa"
import swaggerUi from "swagger-ui-express"
import swaggerDoc from "../../generated/swagger.json"
import express, { json, urlencoded, Request as ExRequest, Response as ExResponse, NextFunction } from "express"
import { RegisterRoutes } from "../../generated/routes"
import { logger } from "../settings"
import * as Dss from "../dss"

const app = express()

app.use(urlencoded({ extended: true }))
app.use(json())
app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerDoc as object))

RegisterRoutes(app)

/**
 * Error handling. All errors yield a json response with a string code and an
 * error message providing more detail.
 */
app.use(function errorHandler(err: unknown, req: ExRequest, res: ExResponse, next: NextFunction): ExResponse | void {
    /* Syntax errors arise if we're given invalid json bodies. */
    if (err instanceof SyntaxError && (err as any).type === "entity.parse.failed") {
        logger.debug(`Caught syntax error for ${req.path}`)
        return res.status(422).json({
            code: "VALIDATION_INVALID_JSON",
            message: "Invalid json in request body"
        })
    }

    /* Process validation errors. These are produced and handled by the express
     * server and the tsoa boilerplate. See
     * https://tsoa-community.github.io/docs/error-handling.html */
    if (err instanceof ValidateError) {
        logger.debug(`Caught Validation Error for ${req.path}:`, err.fields)
        return res.status(422).json({
            code: "VALIDATION_FAILED",
            message: `Input validation failed: ${JSON.stringify(err.fields)}`
        })
    }

    /* Process DSS-related errors. */
    if (err instanceof Dss.Errors.DssError) {
        logger.debug(`Caught DSS Error for ${req.path}.`)
        return res.status(400).json({
            code: `DSS_${err.code}`,
            message: `DSS reported an error: ${err.message}`
        })
    }

    /* The fallback error indicates missing code paths and should be
     * treated as an error. */
    if (err instanceof Error) {
        logger.error(`Caught unhandled error for ${req.path}.`)
        return res.status(500).json({
            code: "SYS_UNHANDLED_ERROR",
            message: "Unhandled error"
        })
    }

    next()
})

// TODO: Print proper error messages for requests to undefined paths
//       or usage of undefined methods for defined paths.

export { app }

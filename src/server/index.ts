import { ValidateError } from "tsoa"
import swaggerUi from "swagger-ui-express"
import swaggerDoc from "../../generated/swagger.json"
import express, { json, urlencoded, Request as ExRequest, Response as ExResponse, NextFunction } from "express"
import { RegisterRoutes } from "../../generated/routes"

const app = express()

app.use(urlencoded({ extended: true }))
app.use(json())
app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerDoc as object))

RegisterRoutes(app)

/* Configure pretty error messages for validation errors. See
 *
 *     https://tsoa-community.github.io/docs/error-handling.html */
app.use(function errorHandler(err: unknown, req: ExRequest, res: ExResponse, next: NextFunction): ExResponse | void {
    if (err instanceof ValidateError) {
        console.warn(`Caught Validation Error for ${req.path}:`, err.fields)
        return res.status(422).json({
            message: "Input Validation Failed",
            details: err.fields
        })
    }
    if (err instanceof Error) {
        return res.status(500).json({
            message: "Internal Server Error"
        })
    }

    next()
})

export { app }

import swaggerUi from "swagger-ui-express"
import swaggerDoc from "../../generated/swagger.json"
import express, { json, urlencoded } from "express"
import { RegisterRoutes } from "../../generated/routes"
import { LIB_VERSION } from "../version"

const app = express()

app.use(urlencoded({ extended: true }))
app.use(json())
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc as object))
app.get("/", (_req, res) => {
    res.send(`Local module ${LIB_VERSION} listening.`)
})

RegisterRoutes(app)

export { app }

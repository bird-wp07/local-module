import swaggerUi from "swagger-ui-express"
import swaggerDoc from "../../generated/swagger.json"
import express, { json, urlencoded } from "express"
import { RegisterRoutes } from "../../generated/routes"

const app = express()

app.use(urlencoded({ extended: true }))
app.use(json())
app.use("/", swaggerUi.serve, swaggerUi.setup(swaggerDoc as object))

RegisterRoutes(app)

export { app }

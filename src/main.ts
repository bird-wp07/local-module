import express from "express";

const app = express();
const port = process.env.LOCAL_MODULE_PORT ? process.env.LOCAL_MODULE_PORT : 2048;

app.get("/", (_req, res) => {
    res.send(`Local module v${process.env.npm_package_version}`);
});

app.listen(port, () => {
    console.log(`Listening on port ${port}.`);
});

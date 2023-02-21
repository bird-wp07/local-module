
# Integration Documentation
This page is only the developer's documentation of the Local Module. If you are looking for the documentation about integrating and using the Local Module, please switch to [Integration Documentation](docs/README.md).


# Developer Setup

Developer setup for UNIX systems (Windows/WSL, Linux, Mac).

1. Clone repository, `npm i`
2. Set up secrets
    - Store central service mTLS client cert/key file as ***cs-auth-mtls-client-certkey.p12***.
    - Store central service mTLS server cert file as ***cs-auth-mtls-server-cert.pem***.
    - Create a file named ***.env*** with the following contents and fill in the passphrase.
        ```
        WP07_LOCAL_MODULE_BASEURL=http://127.0.0.1:2048
        WP07_DSS_BASEURL=http://127.0.0.1:8080
        WP07_CS_BASEURL=http://46.83.201.35.bc.googleusercontent.com
        WP07_CS_ISSUER_ID=8d51fa75-b98e-4d8f-98f1-dee5d471a450
        WP07_CS_TOKEN_URL=https://225.96.234.35.bc.googleusercontent.com/realms/bird-cs-dev/protocol/openid-connect/token
        WP07_CS_CA_PEM=cs-auth-mtls-server-cert.pem
        WP07_CS_CLIENT_PFX=cs-auth-mtls-client-certkey.p12
        WP07_CS_CLIENT_PFX_PASSWORD=______________
        ```
    - Add the three files to the local ignore list ***.git/info/exclude***.
3. Test the setup by running containerized tests: `npm run test0`.

# Useful commands

- Start DSS: `./scripts/dss.sh run`. See `./scripts/dss.run --help` for.
- Start local module: `npm run start`
- Start local module in debug session: `npm run start:debug`
- Run tests (may depend on DSS and local module): `npm run test`
- Run self-contained tests from working tree: `npm run test0`
- Run test in debug session: `npm run test:debug`

# Directory Tree

```
.
├── bundle/
│   └── win10-x64/                  - files contained in the windows bundle
├── dist/                           - compiled javascript output
├── docs/                           - user manual source files
├── generated/
│   └── version.ts                  - generated .ts source file exporting version
├── node_modules/                   - customary node modules direcory
├── scripts/                        - assorted scripts and helpers; see the files' header comments
├── src/                            - source code
│   ├── applogic/                   - application logic abstraction layer
│   ├── cs/                         - central service mini SDK
│   ├── dss/                        - DSS related mini SDK
│   ├── server/                     - HTTP API and server related sources
│   ├── settings/                   - runtime configuration
│   ├── utility/                    - utils and helpers
│   └── main.ts                     - main entrypoint of application
├── tests/                          - Tests source code
├── .env                            - config file to set or override envvars
├── cs-auth-mtls-client-certkey.p12 - mTLS client certificate and private key file
├── cs-auth-mtls-server-cert.pem    - mTLS server certificate file
├── package.json                    - customary package.json
├── package-lock.json               - customary package-lock.json
├── README.md                       - this README
└── tsconfig.json                   - customary tsconfig.json
```

# Resources

- [Latest Local Module Integration Documentation](https://github.com/bird-wp07/local-module/tree/main/docs)
- [EN 319 142-1](https://www.etsi.org/deliver/etsi_en/319100_319199/31914201/01.01.01_60/en_31914201v010101p.pdf) - PAdES Standard Part 1
- [EN 319 142-2](https://www.etsi.org/deliver/etsi_en/319100_319199/31914202/01.01.01_60/en_31914202v010101p.pdf) - PAdES Standard Part 2
- [EN 319 12201](https://www.etsi.org/deliver/etsi_en/319100_319199/31912201/01.01.05_20/en_31912201v010105a.pdf) - CAdES Standard
- [DSS Documentation](https://ec.europa.eu/digital-building-blocks/DSS/webapp-demo/doc/dss-documentation.html)
- [Hosted DSS Webapp](https://ec.europa.eu/digital-building-blocks/DSS/webapp-demo/)
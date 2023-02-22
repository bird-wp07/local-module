import { Base64 } from "../utility"
import { AxiosError, AxiosRequestConfig } from "axios"
import { ok, err, Result } from "neverthrow"
import {
    IIssueSignatureResponse,
    Schema_IFetchAuthToken,
    IFetchAuthTokenResponse,
    IValidateIssuanceResponse,
    IRevokeIssuanceResponse,
    Schema_IValidateIssuanceResponse,
    EIssuanceRevocationStatus
} from "./types"
import * as qs from "qs"
import * as Utility from "../utility"
import * as https from "https"
import * as fs from "fs"
import { EDigestAlgorithm } from "../dss"

export abstract class ICsClient {
    abstract isOnline(): Promise<boolean>
    abstract issueSignature(digestToBeSigned: Base64, digestMethod: EDigestAlgorithm, issuerId: string, auditLog?: string): Promise<Result<IIssueSignatureResponse, Error>>
    abstract validateIssuance(signatureValueDigest: Base64): Promise<Result<IValidateIssuanceResponse, Error>>
    abstract revokeIssuance(signatureValueDigest: Base64, revocationReason: string, auditLog?: string): Promise<Result<IRevokeIssuanceResponse, Error>>
}

export class CsClient implements ICsClient {
    baseurl: string
    tokenUrl: string
    authHttpsAgent: https.Agent
    constructor(baseurl: string, tokenUrl: string, mtlsClientPfxFile: string, mtslClientPfxFilePassword: string, mtlsCaPemfile: string) {
        this.baseurl = baseurl
        this.tokenUrl = tokenUrl
        this.authHttpsAgent = new https.Agent({
            ca: fs.readFileSync(mtlsCaPemfile),
            pfx: fs.readFileSync(mtlsClientPfxFile),
            passphrase: mtslClientPfxFilePassword
        })
    }

    /**
     * Factory for exception-free construction of CsClients.
     */
    static make(baseurl: string, tokenUrl: string, mtlsClientPfxFile: string, mtslClientPfxFilePassword: string, mtlsCaPemfile: string): Result<CsClient, Error> {
        try {
            return ok(new CsClient(baseurl, tokenUrl, mtlsClientPfxFile, mtslClientPfxFilePassword, mtlsCaPemfile))
        } catch (error: unknown) {
            if (error instanceof Error) {
                return err(error)
            }
            return err(new Error(JSON.stringify(error)))
        }
    }

    /**
     * Returns true iff the CS reponds to requests.
     */
    async isOnline(): Promise<boolean> {
        // COMBAK: Eventually use the central service's /health endpoint.
        const config: AxiosRequestConfig = {
            method: "GET",
            url: "/swagger-ui/index.html",
            baseURL: this.baseurl
        }
        const rsltHttpReq = await Utility.httpReq(config)
        if (rsltHttpReq.isErr()) {
            return false
        }
        return true
    }

    /**
     * Returns a CAdES-conforming CMS object.
     *
     * See EN 319 122-1.
     */
    async issueSignature(digestToBeSigned: Base64, digestMethod: EDigestAlgorithm, issuerId: string, auditLog?: string): Promise<Result<IIssueSignatureResponse, Error>> {
        const rsltFetchAuthToken = await this.fetchAuthToken()
        if (rsltFetchAuthToken.isErr()) {
            return err(rsltFetchAuthToken.error)
        }
        const tokenContainer = rsltFetchAuthToken.value

        const config: AxiosRequestConfig = {
            method: "POST",
            url: "/api/auth/v1/signer/issuances",
            baseURL: this.baseurl,
            headers: { Authorization: `Bearer ${tokenContainer.access_token}` },
            data: {
                hash: digestToBeSigned,
                digestMethod: digestMethod,
                issuerId: issuerId,
                auditLog: auditLog
            }
        }
        const rsltHttpReq = await Utility.httpReq(config)
        if (rsltHttpReq.isErr()) {
            return err(rsltHttpReq.error)
        }
        return ok(rsltHttpReq.value.data)
    }

    /**
     * Checks the validity of an issued signature. Checks whether a signature
     * has been issued in the first place, whether it has been revoked and
     * whether the issuer is legitimate. Issuances are identified by the SHA256
     * digest of their signature' CMS's signature value.
     *
     * @param signatureValueDigest: SHA256 digest of the signature value
     */
    async validateIssuance(signatureValueDigest: Base64): Promise<Result<IValidateIssuanceResponse, Error>> {
        const config: AxiosRequestConfig = {
            method: "GET",
            url: "/api/v1/verifier/verifications",
            baseURL: this.baseurl,
            params: {
                hash: signatureValueDigest,
                hashType: "SIGNATURE_HASH"
            },
            paramsSerializer: { serialize: (params) => qs.stringify(params) }
        }
        const rsltHttpReq = await Utility.httpReq(config)
        if (rsltHttpReq.isErr()) {
            return err(rsltHttpReq.error)
        }

        /* Validate response */
        const validationResponse = Schema_IValidateIssuanceResponse.validate(rsltHttpReq.value.data)
        if (validationResponse.error !== undefined) {
            return err(validationResponse.error)
        }

        return ok(rsltHttpReq.value.data)
    }

    // TODO: implement
    async revokeIssuance(signatureValueDigest: Base64, revocationReason: string, auditLog?: string): Promise<Result<IRevokeIssuanceResponse, Error>> {
        const rsltFetchAuthToken = await this.fetchAuthToken()
        if (rsltFetchAuthToken.isErr()) {
            return err(rsltFetchAuthToken.error)
        }
        const tokenContainer = rsltFetchAuthToken.value

        const config: AxiosRequestConfig = {
            method: "POST",
            url: "/api/v1/revocation/signaturerevocations",
            baseURL: this.baseurl,
            headers: { Authorization: `Bearer ${tokenContainer.access_token}` },
            data: {
                hash: signatureValueDigest,
                revocationReason: revocationReason,
                hashType: "SIGNATURE_HASH",
                auditLog: auditLog
            }
        }
        const rsltHttpReq = await Utility.httpReq(config)

        // TODO: Write validation
        if (rsltHttpReq.isErr()) {
            if (rsltHttpReq.error instanceof AxiosError) {
                const statuscode = rsltHttpReq.error.response?.status
                if (statuscode === 409) {
                    return ok({
                        status: EIssuanceRevocationStatus.ISSUANCE_ALREADY_REVOKED
                    })
                }
                if (statuscode === 404) {
                    return ok({
                        status: EIssuanceRevocationStatus.ISSUANCE_UNKNOWN
                    })
                }
            }
            return err(rsltHttpReq.error)
        }
        return ok({
            status: EIssuanceRevocationStatus.ISSUANCE_REVOKED,
            revocationDate: new Date(rsltHttpReq.value.data.revocationDate as string)
        })
    }

    /**
     * Returns container object containing the authentication token.
     */
    async fetchAuthToken(): Promise<Result<IFetchAuthTokenResponse, Error>> {
        const config: AxiosRequestConfig = {
            method: "POST",
            url: this.tokenUrl,
            data: {
                client_id: "bird-issuance-service",
                grant_type: "password",
                scope: "issueing"
            },
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            httpsAgent: this.authHttpsAgent
        }
        const rsltHttpReq = await Utility.httpReq(config)
        if (rsltHttpReq.isErr()) {
            return err(rsltHttpReq.error)
        }

        /* Validate response */
        const validationResponse = Schema_IFetchAuthToken.validate(rsltHttpReq.value.data)
        if (validationResponse.error !== undefined) {
            return err(validationResponse.error)
        }

        return ok(rsltHttpReq.value.data)
    }
}

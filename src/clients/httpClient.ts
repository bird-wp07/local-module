import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios"
import { err, ok, Result } from "neverthrow"

export abstract class IHttpClient {
    public abstract setBaseUrl(baseUrl: string): void

    public abstract get<T>(path: string): Promise<Result<T, AxiosError | Error>>

    public abstract post<T>(path: string, body: unknown): Promise<Result<T, AxiosError | Error>>
}

export class HttpClient implements IHttpClient {
    protected baseUrl: string

    public setBaseUrl(baseUrl: string): void {
        this.baseUrl = baseUrl
    }

    public async get<T>(path: string): Promise<Result<T, AxiosError | Error>> {
        const config: AxiosRequestConfig = {
            method: "GET",
            url: path,
            baseURL: this.baseUrl
        }
        const response = await this.runHttpRequest(config)
        if (response.isErr()) {
            return err(response.error)
        }
        return ok(response.value.data)
    }

    public async post<T>(path: string, body: unknown): Promise<Result<T, AxiosError | Error>> {
        const config: AxiosRequestConfig = {
            method: "POST",
            url: path,
            baseURL: this.baseUrl,
            data: body
        }
        const response = await this.runHttpRequest(config)
        if (response.isErr()) {
            return err(response.error)
        }
        return ok(response.value.data)
    }

    private async runHttpRequest(config: AxiosRequestConfig): Promise<Result<AxiosResponse, AxiosError | Error>> {
        try {
            const response = await axios(config)
            return ok(response)
        } catch (error: unknown) {
            if (error instanceof AxiosError || error instanceof Error) {
                return err(error)
            }
            return err(new Error("An unhandled error occurred."))
        }
    }
}

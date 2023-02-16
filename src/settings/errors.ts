export class InvalidSettings extends Error {
    public constructor(message: string) {
        super(message)
    }
}

export class InvalidEnvvarValue extends InvalidSettings {
    public envvar: string
    public value?: string
    public constructor(envvar: string, value?: string, messageAppendix?: unknown) {
        const valStr = value == undefined ? "" : value
        let message = `Mandatory environment variable '${envvar}' has invalid value '${valStr}'.`
        if (messageAppendix !== undefined) {
            message += ` Details: ${JSON.stringify(messageAppendix, null, 4)}`
        }
        super(message)
        this.envvar = envvar
        this.value = value
    }
}

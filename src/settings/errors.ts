export class InvalidSettings extends Error {
    public constructor(message: string) {
        super(message)
    }
}

export class MissingEnvvar extends InvalidSettings {
    public envvar: string
    public constructor(envvar: string, messageAppendix?: string) {
        let message = `Mandatory environment variable '${envvar}' is unset.`
        if (messageAppendix !== undefined) {
            message += ` ${messageAppendix}`
        }
        super(message)
        this.envvar = envvar
    }
}

export class InvalidEnvvarValue extends InvalidSettings {
    public envvar: string
    public value: string
    public constructor(envvar: string, value: string, messageAppendix?: string) {
        let message = `Mandatory environment variable '${envvar}' has invalid value '${value}'.`
        if (messageAppendix !== undefined) {
            message += ` ${messageAppendix}`
        }
        super(message)
        this.envvar = envvar
        this.value = value
    }
}

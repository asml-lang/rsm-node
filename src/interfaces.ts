export interface Device {
    _id: string,
    name: string,
    models?: Array<string>,
    models_has_state?: Array<string>,
}

export interface Model {
    _id: string,
    name: string,
    content: string,
    device_id: string,
    state?: any,
}

export interface State {
    _id: string,
    device_id: string,
    model_id: string,
    content: string,
}

export interface Config {
    server?: Server,
    name: string
}

export interface Server {
    url: string,
    port: number
}
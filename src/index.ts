import { Device, Model, State, Config } from './interfaces';
import { Api } from './api';
import { v4 as uuidv4 } from 'uuid';
import AsmlValidator from 'asml-validator';

export default class RunTimeStateMigration {
    private device: Device;
    private api: any;
    private models: Array<Model> = [];
    private devices: Array<Device> = [];
    private onDevice !: Function;
    private onState !: Function;
    private onRequestState !: Function;
    private asmlValidator = new AsmlValidator();

    constructor(config: Config, onState?: Function, onRequestState?: Function, onDevice?: Function) {
        this.api = new Api(config.server, this.onMessage.bind(this), this.onOnline.bind(this));
        this.device = { _id: uuidv4(), name: config.name }
        this.onDevice = undefined ? () => { } : onDevice;
        this.onState = undefined ? () => { } : onState;
        this.onRequestState = undefined ? () => { } : onRequestState;
    }

    addModel(content: any) {
        if (this.asmlValidator.validateModel(content)) {
            console.log(content.info.title, 'added');
            if (!this.getModel(content.info.title)) {
                const model: Model = {
                    _id: uuidv4(),
                    name: content.info.title,
                    content,
                    device_id: this.device._id,
                    state: {},
                }
                return this.models.push(model);
            }
        }
        throw new Error(this.asmlValidator.errors);
    }

    async introduce() {
        if (this.models.length > 0) {
            await this.api.run(this.device);
            for (const model of this.models) {
                await this.api.publishDevice(this.device, model);
            }
        } else {
            throw new Error("At least one model needs to be added.");
        }
    }

    getStateDevice(model_name: string, device_id: string) {
        this.api.getStateDevice(model_name, device_id, this.device);
    }

    setState(model_name: string, state: any) {
        const model = this.getModel(model_name);
        if (model !== undefined) {
            model.state = state;
        } else {
            throw new Error(`On Message: could not find the model '${model_name}'`);
        }
    }

    sendState(model_name: string, device_id: string) {
        console.log('sendState');
        const model = this.getModel(model_name);
        if (model !== undefined) {
            console.log(model_name, device_id, this.device, model.state);
            this.api.publishState(model_name, device_id, this.device, model.state);
        } else {
            throw new Error(`On Message: could not find the model '${model_name}'`);
        }
    }

    getDevice() {
        return this.device;
    }

    getModel(name: string) {
        return this.models.find(model => model !== undefined && model.name == name);
    }

    getModels() {
        return this.models;
    }

    getDevices(model_name: string) {
        const model = this.getModel(model_name);
        if (model !== undefined) {
            return this.devices.filter(device => device.models.findIndex(key => key === model_name) >= 0);
        }
        throw new Error(`Devices: could not find the model '${model_name}'`);
    }

    private onMessage(model_name: string, message: any, device_id?: string) {
        const model = this.getModel(model_name);
        if (model !== undefined) {
            if (message.action === 'device') {

                console.log('onMessage', 'model', model.name);

                const device = message.data.device;
                console.log('onMessage', 'model', device.name);

                if (device.models === undefined) {
                    device.models = [];
                }
                device.models.push(model_name)
                this.devices.push(device);
                console.log('this.devices', this.devices);

                if (message.data.new) {
                    this.onDevice({ model_name, device });
                    this.api.publishDeviceToNewDevice(device, this.device, model);
                }
            }

            if (message.action === 'request-state' && device_id == this.device._id) {
                this.onRequestState({ model_name, 'device': message.data.device })
            }

            if (message.action === 'response-state' && device_id == this.device._id) {
                this.onState({
                    model_name,
                    device: message.data.device,
                    state: message.data.state,
                    valid: this.asmlValidator.validate(model.content, message.data.state)
                })
            }

        } else {
            throw new Error(`On Message: could not find the model '${model_name}'`);
        }
    }

    private onOnline(device_id: string, online: boolean) {
        if (device_id !== this.device._id) {
            console.log('onOnline:', device_id, online);
            console.log(this.devices);
            if (!online) {
                const index = this.devices.findIndex(device => device._id === device_id);
                if (index >= 0) {
                    this.devices.splice(index, 1);
                }
                console.log(this.devices);
            }
        }
    }
}

module.exports = RunTimeStateMigration;
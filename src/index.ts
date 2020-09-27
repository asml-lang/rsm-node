import { Device, Model, State, Config } from './interfaces';
import { Api } from './api';
import { v4 as uuidv4 } from 'uuid';

export default class RunTimeStateMigration {
    private device: Device;
    private api: any;
    private models: Array<Model> = [];
    private onDevice !: Function;
    private onState !: Function;
    private onRequestState !: Function;

    constructor(config: Config, onState?: Function, onRequestState?: Function, onDevice?: Function) {
        this.api = new Api(config.server, this.onMessage.bind(this));
        this.device = { _id: uuidv4(), name: config.name }
        this.onDevice = undefined ? () => { } : onDevice;
        this.onState = undefined ? () => { } : onState;
        this.onRequestState = undefined ? () => { } : onRequestState;
    }

    addModel(content: any) {
        // TODO: validate the model
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

    async introduce() {
        await this.api.run();
        if (this.models.length > 0) {
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
        }
    }

    sendState(model_name: string, device_id: string) {
        console.log('sendState');
        const model = this.getModel(model_name);
        if (model !== undefined) {
            console.log(model_name, device_id, this.device, model.state);
            this.api.publishState(model_name, device_id, this.device, model.state);
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
            return model.devices;
        }
    }


    private onMessage(model_name: string, message: any, device_id?: string) {
        const model = this.getModel(model_name);
        if (model !== undefined) {
            if (message.action === 'device') {

                console.log('onMessage', 'model', model.name);

                if (model.devices === undefined) {
                    model.devices = [];
                }
                const device = message.data.device;
                console.log('onMessage', 'model', device.name);
                model.devices.push(device);

                if (message.data.new) {
                    this.onDevice({ model_name, device });
                    this.api.publishDeviceToNewDevice(device, this.device, model);
                }
            }

            if (message.action === 'request-state' && device_id == this.device._id) {
                this.onRequestState({ model_name, 'device': message.data.device })
            }

            if (message.action === 'response-state' && device_id == this.device._id) {
                this.onState({ model_name, 'device': message.data.device, 'state': message.data.state })
                console.log('Hooray! I\'ve got your state');
            }
        }
    }
}

module.exports = RunTimeStateMigration;
import { Device, Model, State, Config } from './interfaces';
import { Api } from './api';
import { v4 as uuidv4 } from 'uuid';
import AsmlValidator from 'asml-validator';

const TAG = 'rsm:';

export default class RunTimeStateMigration {
    private device: Device;
    private api: any;
    private models: Array<Model> = [];
    private devices: Array<Device> = [];
    private onDeviceJoin !: Function;
    private onDeviceLeave !: Function;
    private onStateMigration !: Function;
    private onStateReceive !: Function;
    private onStateRequest !: Function;
    private asmlValidator = new AsmlValidator();

    constructor(config: Config,
        onStateRequest?: Function,
        onStateReceive?: Function,
        onStateMigration?: Function,
        onDeviceJoin?: Function,
        onDeviceLeave?: Function,
    ) {
        this.api = new Api(config.server, this.onMessage.bind(this), this.onOnline.bind(this));
        this.device = { _id: uuidv4(), name: config.name }

        this.onStateRequest = undefined ? () => { } : onStateRequest;
        this.onStateReceive = undefined ? () => { } : onStateReceive;
        this.onStateMigration = undefined ? () => { } : onStateMigration;

        this.onDeviceJoin = undefined ? () => { } : onDeviceJoin;
        this.onDeviceLeave = undefined ? () => { } : onDeviceLeave;
    }

    addModel(content: any) {
        if (this.asmlValidator.validateModel(content)) {
            console.log(TAG, content.info.title, 'added');
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
            console.log(TAG, 'setState', model_name, this.device);
        } else {
            throw new Error(`On Message: could not find the model '${model_name}'`);
        }
    }

    setHasState(model_name: string, value: boolean) {
        const model = this.getModel(model_name);
        if (model !== undefined) {
            this.api.publishHasState(model_name, this.device, value);
        } else {
            throw new Error(`On Message: could not find the model '${model_name}'`);
        }
    }

    sendState(model_name: string, device_id: string) {
        console.log(TAG, 'sendState');
        const model = this.getModel(model_name);
        if (model !== undefined) {
            console.log(TAG, model_name, device_id, this.device, model.state);
            this.api.publishState(model_name, device_id, this.device, model.state);
        } else {
            throw new Error(`On Message: could not find the model '${model_name}'`);
        }
    }

    setMigration(model_name: string, device_id: string) {
        console.log(TAG, 'setMigration');
        const model = this.getModel(model_name);
        if (model !== undefined) {
            console.log(TAG, model_name, device_id, this.device, model.state);
            this.api.publishMigration(model_name, device_id, this.device);
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

    getDevices(model_name: string, has_state?: boolean) {
        const model = this.getModel(model_name);
        if (model !== undefined) {
            if (has_state) {
                return this.devices.filter(device => device.models_has_state.findIndex(key => key === model_name) >= 0);
            }
            return this.devices.filter(device => device.models.findIndex(key => key === model_name) >= 0);
        }
        throw new Error(`Devices: could not find the model '${model_name}'`);
    }

    private onMessage(model_name: string, message: any, device_id?: string) {
        const model = this.getModel(model_name);
        if (model !== undefined) {
            if (message.action === 'device') {
                console.log(TAG, 'onMessage', 'message', message);
                console.log(TAG, 'onMessage', 'model', model.name);


                let device = this.devices.find(d => d._id == message.data.device._id);
                if (device === undefined) {
                    const i = this.devices.push(message.data.device);
                    device = this.devices[i - 1];
                }

                if (device.models === undefined) {
                    device.models = [];
                }

                if (device.models_has_state === undefined) {
                    device.models_has_state = [];
                }

                device.models.push(model_name);

                console.log(TAG, 'this.devices/new', this.devices);

                if (message.data.new) {
                    this.onDeviceJoin({ model_name, device });
                    this.api.publishDeviceToNewDevice(device, this.device, model);
                }
            }

            if (message.action === 'request-state' && device_id == this.device._id) {
                this.onStateRequest({ model_name, 'device': message.data.device })
            }

            if (message.action === 'response-state' && device_id == this.device._id) {
                this.onStateReceive({
                    model_name,
                    device: message.data.device,
                    state: message.data.state,
                    valid: this.asmlValidator.validate(model.content, message.data.state)
                })
            }


            if (message.action === 'has-state') {
                const device = this.devices.find(d => d._id == message.data.device._id);
                if (device !== undefined) {
                    if (message.data.value) {
                        if (!device.models_has_state.includes(model_name)) {
                            device.models_has_state.push(model_name);
                        }
                    } else {
                        device.models_has_state.splice(device.models_has_state.indexOf(model_name), 1);
                    }
                }
            }

            if (message.action === 'migration' && device_id == this.device._id) {
                this.onStateMigration({ model_name, 'device': message.data.device })
            }

        } else {
            throw new Error(`On Message: could not find the model '${model_name}'`);
        }
    }

    private onOnline(device_id: string, online: boolean) {
        console.log(TAG, 'onOnline1:', device_id, online);
        if (device_id !== this.device._id) {
            console.log(TAG, 'onOnline2:', device_id, online);
            console.log(TAG, this.devices);
            if (!online) {
                const device = this.devices.find(device => device._id === device_id);
                const index = this.devices.findIndex(device => device._id === device_id);
                if (index >= 0) {
                    this.devices.splice(index, 1);
                    this.onDeviceLeave(device);
                }
                console.log(TAG, this.devices);
            }
        }
    }
}

module.exports = RunTimeStateMigration;

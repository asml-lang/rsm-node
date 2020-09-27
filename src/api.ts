import { AsyncMqttClient as Client, connectAsync as connect } from 'async-mqtt';
import { Device, Model, State, Config, Server } from './interfaces';

const SERVER: Server = {
    url: 'mqtt://130.185.123.111',
    port: 1883
}

export class Api {
    private client: Client;
    private serverConfig: Server;
    private onMessageCallBack: Function;
    constructor(server: Server, onMessageCallBack: Function) {
        this.serverConfig = server === undefined ? SERVER : server;
        this.onMessageCallBack = onMessageCallBack;
    }

    public async run() {
        // models/{model_name}/{from}/{to}
        this.client = await connect(
            this.serverConfig.url,
            {
                port: this.serverConfig.port,
                clean: true
            }
        );

        if (this.client !== undefined) {
            this.client.on('message', this.OnMessage.bind(this));
        }
    }

    public async publishDevice(device: Device, model: Model) {
        const data = {
            action: 'device',
            data: { device, new: true },
        };

        await this.publish(`${model.name}`, data);
        await this.subscribe(`${model.name}`);
        const b = await this.subscribe(`${model.name}/${device._id}`);
        console.log('api:', 'subscribe', `${model.name}/${device._id}`, b);
    }

    public async publishState(model_name: string, device_id: string, device: Device, state: any) {
        const data = {
            action: 'response-state',
            data: { device, state },
        };
        this.publish(`${model_name}/${device_id}`, data);
    }

    public async getStateDevice(model_name: string, device_id: string, device: Device) {
        const data = {
            action: 'request-state',
            data: { device }
        }
        this.publish(`${model_name}/${device_id}`, data);
    }

    public async publishDeviceToNewDevice(otherDevice: Device, device: Device, model: Model) {

        const data = {
            action: 'device',
            data: { device, new: false },
        };

        console.log('publishDeviceToNewDevice', data);

        await this.publish(`${model.name}/${otherDevice._id}`, data);
    }

    private async subscribe(topic: string) {
        return await this.client.subscribe(topic, { qos: 2 });
    }
    private async publish(topic: string, message: any) {
        return await this.client.publish(topic, this.json(message), { qos: 2 });
    }

    private OnMessage(topic: string, payload: Buffer) {
        console.log('api: OnMessage');
        console.log('topic', topic);
        console.log('message',);
        const model_name = topic.split("/").shift();
        const device_id = topic.split("/").length > 0 ? topic.split("/")[1] : undefined;
        this.onMessageCallBack(model_name, this.sonj(payload.toString()), device_id);
    }

    private json(obj: any) {
        return JSON.stringify(obj);
    }

    private sonj(str: string) {
        return JSON.parse(str);
    }

}
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
    private onOnlineCallBack: Function;
    constructor(server: Server, onMessageCallBack: Function, onOnlineCallBack: Function) {
        this.serverConfig = server === undefined ? SERVER : server;
        this.onMessageCallBack = onMessageCallBack;
        this.onOnlineCallBack = onOnlineCallBack;
    }

    public async run(device: Device) {
        // models/{model_name}/{from}/{to}
        this.client = await connect(
            this.serverConfig.url,
            {
                port: this.serverConfig.port,
                clean: true,
                will: { topic: `online/${device._id}`, payload: 'false', qos: 2, retain: true }
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
        await this.setOnline(device._id);
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

    private async setOnline(device_id: string) {
        await this.client.publish(`online/${device_id}`, 'true', { qos: 2, retain: true });
        await this.subscribe('online/+');
    }

    private async subscribe(topic: string) {
        return await this.client.subscribe(topic, { qos: 2 });
    }

    private async publish(topic: string, message: any) {
        return await this.client.publish(topic, this.json(message));
    }

    private OnMessage(topic: string, payload: Buffer) {
        console.log('api: OnMessage');
        console.log('topic', topic);
        console.log('message',);
        const main_topic = topic.split("/").shift();
        const device_id = topic.split("/").length > 0 ? topic.split("/")[1] : undefined;

        if (main_topic === 'online') {
            this.onOnlineCallBack(device_id, payload.toString() == 'true');
        } else {
            this.onMessageCallBack(main_topic, this.sonj(payload.toString()), device_id);
        }
    }

    private json(obj: any) {
        return JSON.stringify(obj);
    }

    private sonj(str: string) {
        return JSON.parse(str);
    }

}
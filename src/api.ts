import { AsyncMqttClient as Client, connectAsync as connect } from 'async-mqtt';
import { Device, Model, State, Config, Server } from './interfaces';

const TAG = 'api:';

const SERVER: Server = {
    url: 'mqtt://130.185.123.111',
    port: 1883
}

export class Api {
    private client: any;
    private serverConfig: Server;
    private onMessageCallBack: Function;
    private onOnlineCallBack: Function;
    constructor(server: Server, onMessageCallBack: Function, onOnlineCallBack: Function) {
        this.serverConfig = server === undefined ? SERVER : server;
        this.onMessageCallBack = onMessageCallBack;
        this.onOnlineCallBack = onOnlineCallBack;
    }

    public async run(device: Device) {
        // {model_name}/{device_id}
        // online/{device_id}
        this.client = await connect(
            this.serverConfig.url,
            {
                port: this.serverConfig.port,
                clean: true,
                will: { topic: `online/${device._id}`, payload: '', qos: 2, retain: true }
            }
        );

        if (this.client !== undefined) {
            this.client.on('message', this.OnMessage.bind(this));

            // set the online status
            await this.setOnline(device._id);
        }
    }

    public async publishDevice(device: Device, model: Model) {
        const data = {
            action: 'device',
            data: { device, new: true },
        };

        // subscribe to its model's topic, so it can receive data from other devices
        const b = await this.subscribe(`${model.name}/${device._id}`);
        console.log(TAG, 'subscribe', b);

        // introduce the device to everybody with the same model
        await this.publish(`${model.name}`, data);

        // subscribe to the same model's topic
        const a = await this.subscribe(`${model.name}`);
        console.log(TAG, 'subscribe', a);

    }

    public async publishState(model_name: string, device_id: string, device: Device, state: any) {
        const data = {
            action: 'response-state',
            data: { device, state },
        };
        return this.publish(`${model_name}/${device_id}`, data);
    }

    public async publishHasState(model_name: string, device: Device, value: boolean) {
        const data = {
            action: 'has-state',
            data: { device, value },
        };
        return this.publish(`${model_name}`, data);
    }

    public async publishMigration(model_name: string, device_id: string, device: Device) {
        const data = {
            action: 'migration',
            data: { device },
        };
        return this.publish(`${model_name}/${device_id}`, data);
    }

    public async getStateDevice(model_name: string, device_id: string, device: Device) {
        const data = {
            action: 'request-state',
            data: { device }
        }
        return this.publish(`${model_name}/${device_id}`, data);
    }

    public async publishDeviceToNewDevice(otherDevice: Device, device: Device, model: Model) {

        const data = {
            action: 'device',
            data: { device, new: false },
        };

        console.log(TAG, 'publishDeviceToNewDevice', `${model.name}/${otherDevice._id}`, data);

        return await this.publish(`${model.name}/${otherDevice._id}`, data);
    }

    private async setOnline(device_id: string) {
        // tell everybody I'm online
        await this.client.publish(`online/${device_id}`, 'true', { qos: 2, retain: true });

        // subscribe to online's topic to get everybody's online status
        await this.subscribe('online/+');

        // unsubscribe itselft from online topic
        await this.client.unsubscribe(`online/${device_id}`);
    }

    private async subscribe(topic: string) {
        return await this.client.subscribe(topic, { qos: 2 });
    }

    private async publish(topic: string, message: any) {
        return await this.client.publish(topic, this.json(message));
    }

    private OnMessage(topic: string, payload: Buffer) {
        console.log(TAG, 'OnMessage');
        console.log(TAG, 'topic', topic);
        console.log(TAG, 'message', payload.toString());

        // get the first part of topic. like: sending-email/1 -> sending-email
        const main_topic = topic.split("/").shift();

        // get the second part of topic. like: sending-email/1 -> 1
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
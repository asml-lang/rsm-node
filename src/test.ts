import RunTimeStateMigration from '.';
// const RunTimeStateMigration = require('.');
import { Device, Model, State, Config } from './interfaces';
import sampleModel from './model-example.json';

console.log(process.argv)

const config = {
  name: 'Saman\'s Macbook Pro',
  // name: 'Saman\'s iPhone',
  // server: 'http://127.0.0.1'
}

config.name = 'demo' + process.argv[2]



if (process.argv[3] !== undefined) {
  sampleModel.info.title = process.argv[3];
}

const sampleState = {
  "from": "saman@mail.upb.de",
  "to": "dennis.wolters@upb.de",
  "body": "this is a text"
}

// const rsm = new RunTimeStateMigration(config, (devices: any) => { console.log('devices', devices) });
const rsm = new RunTimeStateMigration(
  config,
  (onDeviceData: any) => console.log('onDeviceData', onDeviceData),
  (onStateData: any) => console.log('onDeviceData', onStateData),
);
console.log('me:', rsm.getDevice());

async function main() {
  let res;

  console.log('adding a model ...');
  res = rsm.addModel(sampleModel);
  console.log('result:', res);

  console.log('introducing device ...');
  res = await rsm.introduce();
  console.log('result:', res);

  // console.log(rsm.getDevices(sampleModel.info.title));

  // console.log('setting the sample state ...');
  // res = await rsm.setState(sampleState, sampleModel.info.title);
  // console.log('result:', res);

  // console.log('getting devices with same model');
  // res = await rsm.getDevices(sampleModel.info.title);
  // console.log('result:', res);

  // console.log('get the first device state');
  // res = await rsm.getStateById(res[0].state_id);
  // console.log('result:', res);

}

main();

import GeneralTasmotaDriver from "../driver";
import Sensor from "../../lib/sensor";
import GeneralTasmotaDevice from "../device";

export default class ZigbeeDeviceDriver extends GeneralTasmotaDriver {
    static specialSensors: any = {
        'lumi.sensor_wleak.aq1': {
            'attributes': {'0500<00': "000000FF0000"} // "010000FF0000" - on / "000000FF0000" - off
        },
        'lumi.sensor_magnet.aq2': {
            'attributes': {'Contact': "0"}
        },
        'lumi.sensor_magnet': {
            'attributes': {'Contact': "0"}
        },
    };

    async onInit() {
        await super.onInit();
    }

    pairingStarted() {
        this.log('pairingStarted called');
        this.sendMessage('cmnd/sonoffs/ZbStatus1', '');
        this.sendMessage('cmnd/tasmotas/ZbStatus1', '');
        this.sendMessage('sonoffs/cmnd/ZbStatus1', '');
        this.sendMessage('tasmotas/cmnd/ZbStatus1', '');
        return true;
    }

    getTopicsToIgnore() {
        return [];
    }

    sendMessageToDevices(topic: string, message: { ZbReceived: { [x: string]: any; }; ZbStatus3: { [x: string]: any; }; }, prefixFirst: boolean) {
        let topicParts = topic.split('/');
        let topicIndex = prefixFirst ? 1 : 0;
        let devices: any = this.getDevices();
        if ((topicParts.length > 2) && (topicParts[2] === 'LWT')) {
            for (let index = 0; index < devices.length; index++)
                if (devices[index].getMqttTopic() === topicParts[topicIndex]) {
                    this.log(`sendMessageToDevices: LWT ${devices[index].getDeviceId()} <= ${JSON.stringify(message)}`);
                    devices[index].onMessage(topic, message, prefixFirst);
                }
        } else if (typeof message === 'object') {
            if ('ZbReceived' in message) {
                // Example: tele/tasmota_9C9350/SENSOR = {"ZbReceived":{"0xAF4A":{"Device":"0xAF4A","Name":"Test_temperature","Humidity":44.45,"Endpoint":1,"LinkQuality":92}}}
                for (let dstKey in message.ZbReceived) {
                    for (let index = 0; index < devices.length; index++)
                        if ((devices[index].getMqttTopic() === topicParts[topicIndex]) && (devices[index].getDeviceId() === dstKey)) {
                            this.log(`sendMessageToDevices: ZbReceived ${dstKey} <= ${JSON.stringify(message.ZbReceived[dstKey])}`);
                            devices[index].onMessage(topic + '/ZbReceived', message.ZbReceived[dstKey], prefixFirst);
                            break;
                        }

                }
            }
            if (('ZbStatus3' in message) && (Array.isArray(message.ZbStatus3))) {
                // Example: stat/tasmota_9C9350/RESULT = {"ZbStatus3":[{"Device":"0xAF4A","Name":"Test_temperature","IEEEAddr":"0x00124B002269C745","ModelId":"TH01","Manufacturer":"eWeLink","Endpoints":[1],"Config":["T01"],"Temperature":22.42,"Humidity":41.85,"Reachable":true,"BatteryPercentage":100,"LastSeen":33,"LastSeenEpoch":1617186515,"LinkQuality":81}]}
                for (let deviceIndex in message.ZbStatus3) {
                    let devId = message.ZbStatus3[deviceIndex].Device;
                    if (devId) {
                        for (let index = 0; index < devices.length; index++)
                            if ((devices[index].getMqttTopic() === topicParts[topicIndex]) && (devices[index].getDeviceId() === devId)) {
                                this.log(`sendMessageToDevices: ZbStatus3 ${devId} <= ${JSON.stringify(message.ZbStatus3[deviceIndex])}`);
                                devices[index].onMessage(topic + '/ZbStatus3', message.ZbStatus3[deviceIndex], prefixFirst);
                                break;
                            }

                    }
                }
            }
        }
    }

    collectPairingData(topic: string, message: { ZbStatus1: { [x: string]: { Device: any; }; }; }) {
        let topicParts = topic.split('/');
        if ((topicParts[0] === 'stat') || (topicParts[1] === 'stat')) {
            let swapPrefixTopic = topicParts[1] === 'stat';
            let deviceTopic = swapPrefixTopic ? topicParts[0] : topicParts[1];
            if (typeof message === 'object') {
                if ('ZbStatus1' in message) {
                    for (let zbDeviceIndex in message.ZbStatus1) {
                        if ('Device' in message.ZbStatus1[zbDeviceIndex]) {
                            let topic = "";
                            if (swapPrefixTopic)
                                topic = deviceTopic + '/cmnd/ZbStatus3';
                            else
                                topic = 'cmnd/' + deviceTopic + '/ZbStatus3';
                            this.log(`collectPairingData: requesting info from sensor ${deviceTopic}/${JSON.stringify(message.ZbStatus1[zbDeviceIndex])}`);
                            this.sendMessage(topic, message.ZbStatus1[zbDeviceIndex].Device);
                        }
                    }
                }
                if ('ZbStatus3' in message)
                    super.collectPairingData(topic, message);
            }
        }
    }

    getDefaultIcon(settings: any, capabilities: any) {
        return 'zigbee_sensor.svg';
    }

    collectedDataToDevices(deviceTopic: string, messages: any, swapPrefixTopic: any) {
        if (!('ZbStatus3' in messages))
            return [];
        let result = [];
        for (let zbStatusIndex in messages.ZbStatus3) {
            let message = messages.ZbStatus3[zbStatusIndex];
            let deviceId = message.Device;
            if (!deviceId)
                continue;
            let deviceAddr = message.IEEEAddr;
            if (!deviceAddr)
                continue;
            let model = message.ModelId;
            if (!model)
                model = "unknown";
            if (model in ZigbeeDeviceDriver.specialSensors)
                message = {...ZigbeeDeviceDriver.specialSensors[model].attributes, ...message};
            if ('Manufacturer' in message)
                model = `${model} (${message.Manufacturer})`;
            let deviceName: string = ('Name' in message) ? message.Name : `Sensor ${deviceId}`;
            let devItem = {
                data: {id: deviceAddr},
                name: deviceName,
                settings: {
                    mqtt_topic: deviceTopic,
                    swap_prefix_topic: swapPrefixTopic,
                    zigbee_device_id: deviceId,
                    chip_type: model
                },
                capabilities: [""],
                capabilitiesOptions: {},
                class: 'sensor',
                icon: 'icons/zigbee_sensor.svg'
            };
            this.log(`Message: ${JSON.stringify(message)}`);
            let msgObj: any = {'ZbReceived': {}};
            let capCounter = 0;
            msgObj.ZbReceived[deviceId] = message;
            message = msgObj;   // Mimic to zbreceived message
            let supportedAttributes: any = {};
            let dev_icon: string = "";
            Sensor.forEachSensorValue(message, (path: any, value: any) => {
                try {
                    let field = path[path.length - 1];
                    let capObj = Sensor.getPropertyObjectForSensorField(path, 'zigbee', false, deviceId);
                    if (capObj !== null) {
                        supportedAttributes[field] = {
                            'value': value,
                            'capability': capObj,
                            'path': path
                        };
                        if (dev_icon === "" && capObj.icon)
                            dev_icon = capObj.icon;
                        if (!GeneralTasmotaDevice.additionalFields.includes(field))
                            capCounter++;
                    }
                } catch (error) {
                    if (this.debug)
                        throw error;
                }

            }, this.debug);
            if (dev_icon)
                devItem.icon = `icons/${dev_icon}.svg`;
            if (capCounter > 0) {
                this.log(`Attributes found: ${deviceId} => ${JSON.stringify(supportedAttributes)}`);
                for (let attr in supportedAttributes)
                    devItem.capabilities.push(supportedAttributes[attr].capability.capability);
                // Should be added last to be the last in the list
                devItem.capabilities.push('measure_last_seen');
                result.push(devItem);
            }
        }
        return result;
    }

    pairingFinished(messagesCollected: any) {
        this.log('pairingFinished called');
        this.log(`pairingFinished: messages collected ${JSON.stringify(messagesCollected)}`);
        let devices: any = [];
        Object.keys(messagesCollected).sort().forEach(key => {
            let devItems = this.collectedDataToDevices(key, messagesCollected[key].messages, messagesCollected[key].swapPrefixTopic);
            devices = devices.concat(devItems);
        });
        this.log(`pairingFinished: devices found ${JSON.stringify(devices)}`);
        return devices;
    }
}

module.exports = ZigbeeDeviceDriver;

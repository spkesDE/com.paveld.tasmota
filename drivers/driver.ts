import GeneralTasmotaDevice from "./device";
import fs from "fs";
import PairSession from "homey/lib/PairSession";
import Homey, {FlowCardTrigger} from "homey";
import TasmotaMqttApp from "../app";
import * as util from "util";

export default class GeneralTasmotaDriver extends Homey.Driver {

    searchingDevices = false;
    debug: boolean = false;
    messagesCollected: any = {};
    devicesCounter = 0;
    topicsToIgnore: string[] = [];
    checkDevices!: NodeJS.Timer;
    isIconChangeSupported: boolean = false;
    deviceConnectionTrigger!: FlowCardTrigger;

    async onInit() {
        this.debug = (this.homey.app as TasmotaMqttApp).debug;
        this.log(`${this.constructor.name} has been initiated, driver id: ${this.manifest.id}, driver name: ${this.manifest.name.en}`);
        this.checkDevices = setInterval(() => {
            try {
                this.updateDevices();
            } catch (error) {
                if (this.debug)
                    throw(error);
                else
                    this.log(`${this.constructor.name} checkDevices error: ${error}`);
            }
        }, 30000);
        for (let settingsIndex = 0; !this.isIconChangeSupported && (settingsIndex < this.manifest.settings.length); settingsIndex++) {
            if (this.manifest.settings[settingsIndex].id === 'icon_file') {
                this.isIconChangeSupported = true;
                break;
            }
        }
        this.log(`onInit: ${this.constructor.name}`);
        this.deviceConnectionTrigger = this.homey.flow.getTriggerCard('device_connection_changed');

    }

    getDefaultIcon(settings: any, capabilities: any) {
        return 'tasmota.svg';
    }

    removeDeviceIcon(iconFileName: string) {
        let driverIconFolder = GeneralTasmotaDevice.getDriverIconFolder(this.manifest.id, true);
        try {
            fs.unlinkSync(`${driverIconFolder}/${iconFileName}`);
        } catch (error) {
        }
    }

    isDeviceSupportIconChange(device: any) {
        return this.isIconChangeSupported && fs.existsSync(device.getDeviceIconFileName());
    }

    collectPairingData(topic: string, message: any) {
        this.log(`collectPairingData: ${topic} => ${message}`);
        let topicParts = topic.split('/');
        let swapPrefixTopic = topicParts[1] === 'stat';
        let deviceTopic: string = swapPrefixTopic ? topicParts[0] : topicParts[1] ?? "";
        if (!this.topicsToIgnore.includes(deviceTopic) && topicParts[0] === "tele" && message == "Online") {
            //Sending status request to the devices that are not known and online.
            this.sendMessage(`cmnd/${deviceTopic}/Status`, 0);
        }
        if ((topicParts[0] === 'stat') || (topicParts[1] === 'stat')) {
            if (!this.topicsToIgnore.includes(deviceTopic)) {
                if (!(deviceTopic in this.messagesCollected))
                    this.messagesCollected[deviceTopic] = {
                        swapPrefixTopic: swapPrefixTopic,
                        messages: {}
                    };
                for (const msgKey of Object.keys(message)) {
                    if (!Array.isArray(message[msgKey])) {
                        if (!(msgKey in this.messagesCollected[deviceTopic].messages))
                            this.messagesCollected[deviceTopic].messages[msgKey] = [];
                        this.messagesCollected[deviceTopic].messages[msgKey].push(message[msgKey]);
                    } else {
                        if (!(msgKey in this.messagesCollected[deviceTopic].messages))
                            this.messagesCollected[deviceTopic].messages[msgKey] = message[msgKey];
                        else
                            this.messagesCollected[deviceTopic].messages[msgKey] = this.messagesCollected[deviceTopic].messages[msgKey].concat(message[msgKey]);
                    }
                }
            }
        }
    }

    getTopicsToIgnore() {
        let result: string[] = [];
        this.getDevices().forEach((device: any) => {
            result.push(device.getMqttTopic());
        });
        return result;
    }

    updateDevices() {
        this.getDevices().forEach((device: any) => {
            device.checkDeviceStatus();
        });
    }

    onDeviceStatusChange(device: any, newStatus: string, oldStatus: string) {
        if ((oldStatus === 'unavailable') && (newStatus === 'available')) {
            this.deviceConnectionTrigger.trigger({
                name: device.getName(),
                device_id: device.getData().id,
                status: true
            }).then();
        } else if ((oldStatus === 'available') && (newStatus === 'unavailable')) {
            this.deviceConnectionTrigger.trigger({
                name: device.getName(),
                device_id: device.getData().id,
                status: false
            }).then();
        }
    }

    checkDeviceSearchStatus() {
        let devCount = Object.keys(this.messagesCollected).length;
        if (devCount == 0) return false;
        if (devCount === this.devicesCounter) {
            this.devicesCounter = 0;
            return true;
        }
        this.devicesCounter = devCount;
        return false;
    }

    setNewDeviceIcon(iconFile: string, deviceIcon: string) {
        try {
            fs.unlinkSync(deviceIcon);
        } catch (error) {
        }
        try {
            fs.copyFileSync(iconFile, deviceIcon);
        } catch (error) {
        }
    }

    onPair(session: PairSession) {
        this.log(`onPair called`);
        let devices: any[] = [];
        let selectedDevices: any[] = [];
        session.setHandler('list_devices', async () => {
            if (devices.length === 0) {
                if (Object.keys(this.messagesCollected).length === 0)
                    return Promise.reject(new Error(this.homey.__('mqtt_client.no_messages')));
                else
                    return Promise.reject(new Error(this.homey.__('mqtt_client.no_new_devices')));
            }
            this.log(`list_devices: New devices found: ${JSON.stringify(devices)}`);
            return devices;
        });
        session.setHandler("list_devices_selection", async (devices) => {
            selectedDevices = devices;
        });
        session.setHandler('create_devices', async () => {
            if (this.isIconChangeSupported) {
                // Assign icons here!
                let deviceIconsFolderAbs = GeneralTasmotaDevice.getDriverIconFolder(this.manifest.id, true);
                let deviceIconsFolderRel = GeneralTasmotaDevice.getDriverIconFolder(this.manifest.id, false);
                this.log(`Creating ${deviceIconsFolderAbs}`);
                try {
                    fs.mkdirSync(deviceIconsFolderAbs, {recursive: true});
                } catch (error) {
                }
                for (let device in selectedDevices) {
                    try {
                        let iconFileName = selectedDevices[device].icon.substring(selectedDevices[device].icon.lastIndexOf('/') + 1);
                        selectedDevices[device].settings.icon_file = iconFileName;
                        let deviceIconName = GeneralTasmotaDevice.getDeviceIconFileName(selectedDevices[device].data.id);
                        let fullIconName = `${deviceIconsFolderAbs}/${deviceIconName}`
                        this.setNewDeviceIcon(`/assets/icons/devices/${iconFileName}`, fullIconName);
                        selectedDevices[device].icon = `${deviceIconsFolderRel}/${deviceIconName}`;
                        this.log(`create_devices: ${JSON.stringify(selectedDevices[device])}`);
                    } catch (error) {
                        this.log(`Error creating devie ${selectedDevices[device].data.id}`);
                    }
                }
            }
            return selectedDevices;
        });
        session.setHandler('showView', async (viewId) => {
            this.log(`onPair current phase: "${viewId}"`);
            if (viewId === 'loading') {
                if (!(this.homey.app as TasmotaMqttApp).clientAvailable) {
                    this.searchingDevices = false;
                    return Promise.reject(new Error(this.homey.__('mqtt_client.unavailable')));
                }
                //Enable search for devices
                this.searchingDevices = true;
                this.topicsToIgnore = this.getTopicsToIgnore();
                //Send Message for device search
                this.sendMessage("$SYS/broker/clients/connected", "");
                this.log(`Topics to ignore during pairing: ${JSON.stringify(this.topicsToIgnore)}`);
                let interval = setInterval((drvArg: any, sessionArg) => {
                    this.log(`Checking for new devices. ${drvArg.checkDeviceSearchStatus()}`);
                    if (drvArg.checkDeviceSearchStatus()) {
                        clearInterval(interval);
                        this.searchingDevices = false;
                        console.log(util.inspect(this.messagesCollected, false, null, true /* enable colors */))
                        devices = drvArg.pairingFinished(this.messagesCollected);
                        this.messagesCollected = {};
                        sessionArg.emit('list_devices', devices);
                        sessionArg.nextView();
                    }
                }, 2000, this, session);
            }
        });
    }

    sendMessage(topic: string, payload: any) {
        (this.homey.app as TasmotaMqttApp).sendMessage(topic, payload);
    }

    sendMessageToDevices(topic: string, message: any, prefixFirst: boolean) {
        let topicParts = topic.split('/');
        let topicIndex = prefixFirst ? 1 : 0;
        let devices: any = this.getDevices();
        for (let index = 0; index < devices.length; index++)
            if (devices[index].getMqttTopic() === topicParts[topicIndex]) {
                devices[index].onMessage(topic, message, prefixFirst);
                break;
            }

    }

    onMessage(topic: string, message: any, prefixFirst: boolean) {
        if (this.searchingDevices) this.collectPairingData(topic, message);
        this.sendMessageToDevices(topic, message, prefixFirst);
    }

}

module.exports = GeneralTasmotaDriver;

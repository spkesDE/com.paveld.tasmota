import GeneralTasmotaDevice from "./device";
import fs from "fs";
import PairSession from "homey/lib/PairSession";
import Homey, {FlowCardTrigger} from "homey";
import TasmotaMqttApp from "../app";

export default class GeneralTasmotaDriver extends Homey.Driver {

    // methods that should be implement:
    //  pairingStarted - send command to start collect data
    //  pairingFinished - process collected data
    private searchingDevices = false;
    private messagesCounter = 0;
    debug: boolean = false;
    private messagesCollected: any = {};

    private devicesCounter = 0;
    private topicsToIgnore: string[] = [];
    private checkDevices!: NodeJS.Timer;
    private isIconChangeSupported: boolean = false;
    private deviceConnectionTrigger!: FlowCardTrigger;

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
        this.log(`onInit: ${this.constructor.name} ${this.isIconChangeSupported ? "support" : "not support"} icon change`);
        if (this.isIconChangeSupported)
            this.removeUnusedIcons();
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

    removeUnusedIcons() {
        let driverIconFolder = GeneralTasmotaDevice.getDriverIconFolder(this.manifest.id, true);
        try {
            let iconFiles = fs.readdirSync(driverIconFolder);
            let usedIcons: string[] = [];
            this.getDevices().forEach((device: any) => {
                if (this.isDeviceSupportIconChange(device))
                    usedIcons.push(GeneralTasmotaDevice.getDeviceIconFileName(device.getData().id));
            });
            let iconsToRemove = iconFiles.filter(value => !usedIcons.includes(value));
            this.log(`removeUnusedIcons: All icon files: ${JSON.stringify(iconFiles)} used icons: ${JSON.stringify(usedIcons)} icons to delete: ${JSON.stringify(iconsToRemove)}`);
            iconsToRemove.forEach(icon => {
                try {
                    fs.unlinkSync(`${driverIconFolder}/${icon}`);
                } catch (error) {
                }
            });
        } catch (error) {
        }
    }

    isDeviceSupportIconChange(device: any) {
        return this.isIconChangeSupported && fs.existsSync(device.getDeviceIconFileName());
    }

    collectPairingData(topic: string, message: any) {
        let topicParts = topic.split('/');
        if ((topicParts[0] === 'stat') || (topicParts[1] === 'stat')) {
            let swapPrefixTopic = topicParts[1] === 'stat';
            let deviceTopic: string = swapPrefixTopic ? topicParts[0] : topicParts[1] ?? "";
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
            });
        } else if ((oldStatus === 'available') && (newStatus === 'unavailable')) {
            this.deviceConnectionTrigger.trigger({
                name: device.getName(),
                device_id: device.getData().id,
                status: false
            });
        }
    }

    checkDeviceSearchStatus() {
        let devCount = Object.keys(this.messagesCollected).length;
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
        session.setHandler('list_devices', async (data) => {
            if (devices.length === 0) {
                if (this.messagesCounter === 0)
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
                this.messagesCounter = 0;
                this.searchingDevices = true;
                this.topicsToIgnore = this.getTopicsToIgnore();
                this.log(`Topics to ignore during pairing: ${JSON.stringify(this.topicsToIgnore)}`);
                let interval = setInterval((drvArg: any, sessionArg) => {
                    if (drvArg.checkDeviceSearchStatus()) {
                        clearInterval(interval);
                        this.searchingDevices = false;
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
        try {
            if (this.searchingDevices) {
                this.messagesCounter++;
                this.collectPairingData(topic, message);
            }
            this.sendMessageToDevices(topic, message, prefixFirst);
        } catch (error) {
            if (this.debug)
                throw(error);
            else
                this.log(`onMessage error: ${error}`);
        }
    }

}

module.exports = GeneralTasmotaDriver;

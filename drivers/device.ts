'use strict';

const Homey = require('homey');

export default class GeneralTasmotaDevice extends Homey.Device {
    static getDriverIconFolder(driverName: string, absolutePath = true) {
        if (absolutePath)
            return `/userdata/icons/${driverName}`;
        else
            return `../../../userdata/icons/${driverName}`
    }

    static getDeviceIconFileName(deviceId: string) {
        return `${deviceId}.svg`;
    }

    sendMqttCommand(command: string, content: any) {
        let topic = this.getMqttTopic();
        if (this.swap_prefix_topic)
            topic = topic + '/cmnd/' + command;
        else
            topic = 'cmnd/' + topic + '/' + command;
        // this.log(`Sending command: ${topic} => ${content}`);
        this.driver.sendMessage(topic, content);
    }

    async onInit() {
        this.debug = this.homey.app.debug;
        this.log(`Device initialization. Name: ${this.getName()}, class: ${this.getClass()}, id: ${this.getData().id}`);
        let settings = this.getSettings();
        this.log(`Setting: ${JSON.stringify(settings)}`);
        this.log(`Capabilities: ${JSON.stringify(this.getCapabilities())}`);
        this.supportIconChange = this.isIconChangeSupported();
        this.log(`Icon change supported: ${this.supportIconChange}`);
        if (!this.hasCapability('measure_signal_strength'))
            await this.addCapability('measure_signal_strength');
        this.swap_prefix_topic = settings.swap_prefix_topic;
        this.stage = 'init';
        this.answerTimeout = undefined;
        this.nextRequest = Date.now();
        this.updateInterval = settings.update_interval * 60 * 1000;
        this.timeoutInterval = 40 * 1000;
        await this.invalidateStatus(this.homey.__('device.unavailable.startup'));
    }

    getMqttTopic() {
        return this.getSettings()['mqtt_topic'];
    }

    sendMessage(topic: string, message: any) {
        this.sendMqttCommand(topic, message);
        let updateTm = Date.now() + this.timeoutInterval;
        if ((this.answerTimeout === undefined) || (updateTm < this.answerTimeout))
            this.answerTimeout = updateTm;
    }

    getDeviceIconFileName() {
        return `${GeneralTasmotaDevice.getDriverIconFolder(this.driver.manifest.id)}/${GeneralTasmotaDevice.getDeviceIconFileName(this.getData().id)}`;
    }

    setDeviceStatus(newStatus: any) {
        // uncoment if you need to know who is calling function
        // this.log(`setDeviceStatus: ${JSON.stringify(this.getFunctionCallers(5))}`);
        if (this.stage !== newStatus) {
            this.log(`Device status changed ${this.stage} => ${newStatus}`)
            let oldStatus = this.stage;
            this.stage = newStatus;
            this.driver.onDeviceStatusChange(this, newStatus, oldStatus);
        }
    }

    isIconChangeSupported() {
        return this.driver.isDeviceSupportIconChange(this);
    }

    async checkDeviceStatus() {
        let now = Date.now();
        if ((this.stage === 'available') && (this.answerTimeout !== undefined) && (now >= this.answerTimeout)) {
            this.setDeviceStatus('unavailable');
            await this.invalidateStatus(this.homey.__('device.unavailable.timeout'));
        }
        if (now >= this.nextRequest) {
            this.nextRequest = now + this.updateInterval;
            this.updateDevice();
        }
    }

    async invalidateStatus(message: string) {
        await this.setUnavailable(message);
        this.updateDevice();
    }

    updateDevice() {
    }

    applyNewIcon(iconFile: string) {
        let file = iconFile;
        if (file === 'default') {
            file = this.driver.getDefaultIcon(this.getSettings(), this.getCapabilities());
            this.log(`Applyig icon file as default: ${JSON.stringify(file)}`);
        } else
            this.log(`Applyig new icon file ${JSON.stringify(file)}`);
        this.driver.setNewDeviceIcon(`/assets/icons/devices/${file}`, this.getDeviceIconFileName());
        //this.homey.notifications.createNotification({excerpt: "Please, restart application to apply new icon"});
        return file;
    }

    async onSettings(event: any) {
        this.log(`onSettings: changes ${JSON.stringify(event.changedKeys)}`);
        if (event.changedKeys.includes('icon_file') && this.supportIconChange) {
            let iconFile = event.newSettings.icon_file;
            let realFile = this.applyNewIcon(iconFile);
            if (iconFile !== realFile)
                setTimeout(() => {
                    this.setSettings({icon_file: realFile});
                }, 200);
        }
        if (event.changedKeys.includes('mqtt_topic') || event.changedKeys.includes('swap_prefix_topic')) {
            this.swap_prefix_topic = event.newSettings.swap_prefix_topic;
            setTimeout(() => {
                this.setDeviceStatus('init');
                this.nextRequest = Date.now();
                this.invalidateStatus(this.homey.__('device.unavailable.update'));
            }, 3000);
        }
    }

    onDeleted() {
        this.driver.removeDeviceIcon(GeneralTasmotaDevice.getDeviceIconFileName(this.getData().id));
    }

    async updateCapabilityValue(cap: string, value: any) {
        if (this.hasCapability(cap)) {
            let oldValue = this.getCapabilityValue(cap);
            //this.log(`updateCapabilityValue: ${cap}: ${oldValue} => ${value}`);
            await this.setCapabilityValue(cap, value);
            return oldValue !== value;
        }
        return false;
    }

    getValueByPath(obj: any, path: any) {
        try {
            let currentObj = obj;
            let currentPathIndex = 0;
            while (currentPathIndex < path.length) {
                currentObj = currentObj[path[currentPathIndex]];
                currentPathIndex++;
            }
            return currentObj;
        } catch (error) {
            return undefined;
        }
    }

    async onDeviceOffline() {
        this.setDeviceStatus('unavailable');
        await this.invalidateStatus(this.homey.__('device.unavailable.offline'));
        this.nextRequest = Date.now() + this.updateInterval;
    }

    async onMessage(topic, message, prefixFirst) {
        if (this.swap_prefix_topic === prefixFirst)
            return;
        this.log(`onMessage: ${topic} => ${JSON.stringify(message)}`);
        let topicParts = topic.split('/');
        if (topicParts.length < 3)
            return;
        try {
            if ((topicParts[2] === 'LWT') && (message === 'Offline')) {
                await this.onDeviceOffline();
                return;
            }
            if (this.stage === 'available') {
                this.nextRequest = Date.now() + this.updateInterval;
                this.answerTimeout = undefined;
            }
            this.processMqttMessage(topic, message);
        } catch (error) {
            if (this.debug)
                throw(error);
            else
                this.log(`onMessage error: ${error}`);
        }
    }

}

module.exports = GeneralTasmotaDevice;

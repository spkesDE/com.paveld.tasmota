'use strict';

const GeneralTasmotaDevice = require('../device.js');
const Sensor = require('../../lib/sensor.js');

//const Utils = require('../../lib/utils.js');

class ZigbeeDevice extends GeneralTasmotaDevice {
    static additionalFields = ['BatteryPercentage', 'LinkQuality', 'LastSeen'];
    public getSettings: any;
    public device_id: any;
    public zigbee_timeout: any;
    public lastSeen: any;
    public sendMessage: any;
    public log: any;
    public supportIconChange: any;
    public applyNewIcon: any;
    public setSettings: any;
    public swap_prefix_topic: any;
    public setDeviceStatus: any;
    public nextRequest: any;
    public invalidateStatus: any;
    public homey: any;
    public hasCapability: any;
    public getCapabilityValue: any;
    public setCapabilityValue: any;
    public stage: any;
    public setAvailable: any;
    public answerTimeout: any;
    public debug: any;
    public getMqttTopic: any;

    async onInit() {
        let settings = this.getSettings();
        this.device_id = settings.zigbee_device_id;
        this.zigbee_timeout = settings.zigbee_timeout;
        await super.onInit();
        this.lastSeen = undefined;
    }

    getDeviceId() {
        return this.device_id;
    }

    updateDevice() {
        this.sendMessage('ZbStatus3', this.getDeviceId());
    }

    async onSettings(event) {
        this.log(`onSettings: changes ${JSON.stringify(event.changedKeys)}`);
        if (event.changedKeys.includes('icon_file') && this.supportIconChange) {
            let iconFile = event.newSettings.icon_file;
            let realFile = this.applyNewIcon(iconFile);
            if (iconFile !== realFile)
                setTimeout(() => {
                    this.setSettings({icon_file: realFile});
                }, 200);
        }
        if (event.changedKeys.includes('mqtt_topic') || event.changedKeys.includes('swap_prefix_topic') || event.changedKeys.includes('zigbee_device_id')) {
            this.swap_prefix_topic = event.newSettings.swap_prefix_topic;
            this.device_id = event.newSettings.zigbee_device_id;
            this.lastSeen = undefined;
            setTimeout(() => {
                this.setDeviceStatus('init');
                this.nextRequest = Date.now();
                this.invalidateStatus(this.homey.__('device.unavailable.update'));
            }, 3000);
        }
        if (event.changedKeys.includes('zigbee_timeout')) {
            this.zigbee_timeout = event.newSettings.zigbee_timeout;
            this.nextRequest = Date.now();
        }
    }

    async updateLastSeen() {
        if (this.hasCapability('measure_last_seen') && (this.lastSeen !== undefined)) {
            let oldValue = this.getCapabilityValue('measure_last_seen');
            let newValue = Math.floor((Date.now() - this.lastSeen.getTime()) / 1000);
            if (oldValue !== newValue) {
                await this.setCapabilityValue('measure_last_seen', newValue);
                await this.homey.flow.getDeviceTriggerCard('measure_last_seen_changed')
                    .trigger(this, {value: newValue}, {newValue});
            }
        }
    }

    async checkDeviceStatus() {
        if ((this.lastSeen !== undefined) && (this.stage === 'init')) {
            this.setDeviceStatus('available');
            await this.setAvailable();
        }
        super.checkDeviceStatus();
        let now = Date.now();
        if (this.lastSeen !== undefined) {
            await this.updateLastSeen();
            if ((this.answerTimeout === undefined) || (now < this.answerTimeout)) {
                try {
                    if (this.zigbee_timeout > 0) {
                        let timeout = new Date(this.lastSeen.getTime() + this.zigbee_timeout * 60 * 1000);
                        let device_valid = timeout.getTime() >= now;
                        if ((this.stage === 'available') && !device_valid) {
                            this.setDeviceStatus('unavailable');
                            this.invalidateStatus(this.homey.__('device.unavailable.timeout'));
                        } else if ((this.stage === 'unavailable') && device_valid) {
                            this.setDeviceStatus('available');
                            this.setAvailable();
                        }
                    } else if (this.stage === 'unavailable') {
                        this.setDeviceStatus('available');
                        this.setAvailable();
                    }
                } catch (error) {
                    if (this.debug)
                        throw(error);
                    else
                        this.log(`Zigbee timeout check failed. Error happened: ${error}`);
                }
            }
        }
    }

    checkSensorCapability(capName, newValue, sensorName, valueKind) {
        // this.log(`checkSensorCapability: ${sensorName}.${valueKind} => ${newValue}`);
        let oldValue = this.getCapabilityValue(capName);
        return this.setCapabilityValue(capName, newValue);
    }

    onDeviceOffline() {
        this.lastSeen = undefined;
        super.onDeviceOffline();
    }

    async processMqttMessage(topic, message) {
        try {
            let topicParts = topic.split('/');
            let is_object = typeof message === 'object';
            if ((topicParts.length > 3) && (topicParts[3] === 'ZbReceived')) {
                this.lastSeen = new Date();
                await this.updateLastSeen();
            }
            if (is_object) {
                let tmp_message = {};
                tmp_message[this.getDeviceId()] = message;
                let m_message = {};
                m_message[this.getMqttTopic()] = tmp_message;
                let updatedCap = [];
                Sensor.forEachSensorValue(m_message, (path, value) => {
                    let capObj = Sensor.getPropertyObjectForSensorField(path, 'zigbee', true);
                    let sensorField = path[path.length - 1];
                    let sensor = "";
                    if (path.length > 1)
                        sensor = path[path.length - 2];
                    try {
                        if (sensorField === 'LastSeenEpoch') {
                            let lSeen = new Date(parseInt(value) * 1000);
                            if ((lSeen !== this.lastSeen) || (this.stage === 'unavailable')) {
                                this.lastSeen = lSeen;
                                this.answerTimeout = undefined;
                            }
                            this.checkDeviceStatus();
                        }
                    } catch (error) {
                        if (this.debug)
                            throw(error);
                    }
                    if (capObj !== null) {
                        // Proper sensor value found
                        if (this.hasCapability(capObj.capability) && (value !== null) && (value !== undefined)) {

                            try {
                                let sensorFieldValue = capObj.value_converter != null ? capObj.value_converter(value) : value;
                                if (this.checkSensorCapability(capObj.capability, sensorFieldValue, sensor, sensorField))
                                    updatedCap.push(`${capObj.capability} <= ${sensorFieldValue}`);
                            } catch (error) {
                                if (this.debug)
                                    throw(error);
                                else
                                    this.log(`While processing ${message}.${sensor}.${sensorField} error happened: ${error}`);
                            }
                        }
                    }
                }, this.debug);
                if (updatedCap.length > 0)
                    this.log(`Updated sensor fields: ${updatedCap.join(", ")}`);
            }
        } catch (error) {
            if (this.debug)
                throw(error);
            else
                this.log(`processMqttMessage error: ${error}`);
        }
    }


}

module.exports = ZigbeeDevice;

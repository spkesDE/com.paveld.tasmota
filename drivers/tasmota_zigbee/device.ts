import GeneralTasmotaDevice from "../device";
import Sensor from "../../lib/sensor";

class ZigbeeDevice extends GeneralTasmotaDevice {
    static additionalFields = ['BatteryPercentage', 'LinkQuality', 'LastSeen'];
    private device_id: any;
    private zigbee_timeout: any;
    private lastSeen: Date | undefined;

    async onInit() {
        let settings = this.getSettings();
        this.device_id = settings.zigbee_device_id;
        this.zigbee_timeout = settings.zigbee_timeout;
        await super.onInit();
    }

    getDeviceId() {
        return this.device_id;
    }

    updateDevice() {
        this.sendMessage('ZbStatus3', this.getDeviceId());
    }

    async onSettings(settings: { oldSettings: any, newSettings: any, changedKeys: string[] }): Promise<string | void> {
        this.log(`onSettings: changes ${JSON.stringify(settings.changedKeys)}`);
        if (settings.changedKeys.includes('icon_file') && this.supportIconChange) {
            let iconFile = settings.newSettings.icon_file;
            let realFile = this.applyNewIcon(iconFile);
            if (iconFile !== realFile)
                setTimeout(() => {
                    this.setSettings({icon_file: realFile});
                }, 200);
        }
        if (settings.changedKeys.includes('mqtt_topic') || settings.changedKeys.includes('swap_prefix_topic') || settings.changedKeys.includes('zigbee_device_id')) {
            this.swap_prefix_topic = settings.newSettings.swap_prefix_topic;
            this.device_id = settings.newSettings.zigbee_device_id;
            this.lastSeen = undefined;
            setTimeout(() => {
                this.setDeviceStatus('init');
                this.nextRequest = Date.now();
                this.invalidateStatus(this.homey.__('device.unavailable.update'));
            }, 3000);
        }
        if (settings.changedKeys.includes('zigbee_timeout')) {
            this.zigbee_timeout = settings.newSettings.zigbee_timeout;
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
        await super.checkDeviceStatus();
        let now = Date.now();
        if (this.lastSeen !== undefined) {
            await this.updateLastSeen();
            if ((this.answerTimeout === 0) || (now < this.answerTimeout)) {
                try {
                    if (this.zigbee_timeout > 0) {
                        let timeout = new Date(this.lastSeen.getTime() + this.zigbee_timeout * 60 * 1000);
                        let device_valid = timeout.getTime() >= now;
                        if ((this.stage === 'available') && !device_valid) {
                            this.setDeviceStatus('unavailable');
                            await this.invalidateStatus(this.homey.__('device.unavailable.timeout'));
                        } else if ((this.stage === 'unavailable') && device_valid) {
                            this.setDeviceStatus('available');
                            await this.setAvailable();
                        }
                    } else if (this.stage === 'unavailable') {
                        this.setDeviceStatus('available');
                        await this.setAvailable();
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

    async checkSensorCapability(capName: string, newValue: any, sensorName: string, valueKind: any) {
        // this.log(`checkSensorCapability: ${sensorName}.${valueKind} => ${newValue}`);
        await this.setCapabilityValue(capName, newValue);
        return true;
    }

    async onDeviceOffline() {
        this.lastSeen = undefined;
        await super.onDeviceOffline();
    }

    async processMqttMessage(topic: string, message: any) {
        try {
            let topicParts = topic.split('/');
            let is_object = message instanceof Object;
            if ((topicParts.length > 3) && (topicParts[3] === 'ZbReceived')) {
                this.lastSeen = new Date();
                await this.updateLastSeen();
            }
            if (is_object) {
                let tmp_message: any = {};
                tmp_message[this.getDeviceId()] = message;
                let m_message: any = {};
                m_message[this.getMqttTopic()] = tmp_message;
                let updatedCap: string[] = [];
                Sensor.forEachSensorValue(m_message, async (path: any, value: any) => {
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
                                this.answerTimeout = 0;
                            }
                            await this.checkDeviceStatus();
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
                                if (await this.checkSensorCapability(capObj.capability, sensorFieldValue, sensor, sensorField))
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

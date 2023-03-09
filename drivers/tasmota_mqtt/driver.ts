'use strict';
'use strict';

const Homey = require('homey');

const TasmotaDevice = require('./device.js');
const Sensor = require('../../lib/sensor.js');
const GeneralTasmotaDriver = require('../driver.js');

class TasmotaDeviceDriver extends GeneralTasmotaDriver {

    async onInit() {
        await super.onInit();
        this.registerRunListeners();
    }


    registerRunListeners() {
        this.homey.flow.getConditionCard('dim_level_greater').registerRunListener((args, state) => {
            return Promise.resolve(args.device.getCapabilityValue('dim') * 100 > args.value);
        });
        this.homey.flow.getConditionCard('dim_level_lower').registerRunListener((args, state) => {
            return Promise.resolve(args.device.getCapabilityValue('dim') * 100 < args.value);
        });
        let multiSocketTrigger = this.homey.flow.getDeviceTriggerCard('multiplesockets_relay_state_changed');
        multiSocketTrigger.registerRunListener((args, state) => {
            return Promise.resolve(((args.socket_id.name === 'any socket') || (args.socket_id.name === state.socket_id.name)) &&
                ((args.state === 'state_any') || (args.state === state.state)));
        });
        multiSocketTrigger.getArgument('socket_id').registerAutocompleteListener((query, args) => {
            return Promise.resolve([{name: 'any socket'}].concat(args.device.socketsList));
        });
        this.homey.flow.getDeviceTriggerCard('singlesocket_relay_state_changed').registerRunListener((args, state) => {
            return Promise.resolve((args.state === 'state_any') || (args.state === state.state));
        });
        let multipleSocketCondition = this.homey.flow.getConditionCard('multiplesockets_switch_turned_on');
        multipleSocketCondition.registerRunListener((args, state) => {
            return Promise.resolve(args.device.getCapabilityValue('switch.' + args.socket_id.name.slice(-1)) === true);
        });
        multipleSocketCondition.getArgument('socket_id').registerAutocompleteListener((query, args) => {
            return Promise.resolve(args.device.socketsList);
        });
        this.homey.flow.getConditionCard('multiplesockets_all_switches_turned_on').registerRunListener((args, state) => {
            for (let socketIndex = 1; socketIndex <= args.device.relaysCount; socketIndex++) {
                if (!args.device.getCapabilityValue('switch.' + socketIndex.toString()))
                    return Promise.resolve(false);
            }
            return Promise.resolve(true);
        });
        this.homey.flow.getConditionCard('multiplesockets_some_switches_turned_on').registerRunListener((args, state) => {
            for (let socketIndex = 1; socketIndex <= args.device.relaysCount; socketIndex++) {
                if (args.device.getCapabilityValue('switch.' + socketIndex.toString()))
                    return Promise.resolve(true);
            }
            return Promise.resolve(false);
        });
        let multipleSocketAction = this.homey.flow.getActionCard('multiplesockets_switch_action');
        multipleSocketAction.registerRunListener((args, state) => {
            let valueToSend;
            switch (args.state) {
                case 'state_toggle':
                    valueToSend = 'TOGGLE';
                    break;
                case 'state_on':
                    valueToSend = 'ON';
                    break;
                case 'state_off':
                    valueToSend = 'OFF';
                    break;
                default:
                    return Promise.resolve(false);
            }
            if (args.socket_id.name === 'all sockets') {
                for (let socketIndex = 1; socketIndex <= args.device.relaysCount; socketIndex++)
                    args.device.sendTasmotaPowerCommand(socketIndex.toString(), valueToSend);
                return Promise.resolve(true);
            }
            args.device.sendTasmotaPowerCommand(args.socket_id.name.slice(-1), valueToSend);
            return Promise.resolve(true);
        });
        multipleSocketAction.getArgument('socket_id').registerAutocompleteListener((query, args) => {
            return Promise.resolve([{name: 'all sockets'}].concat(args.device.socketsList));
        });
        this.homey.flow.getConditionCard('fan_speed_greater').registerRunListener((args, state) => {
            return Promise.resolve(args.device.getCapabilityValue("fan_speed") > args.value);
        });
        this.homey.flow.getConditionCard('fan_speed_lower').registerRunListener((args, state) => {
            return Promise.resolve(args.device.getCapabilityValue("fan_speed") < args.value);
        });
        this.homey.flow.getActionCard('fan_speed_action').registerRunListener((args, state) => {
            args.device.sendMessage('FanSpeed', args.value.toString());
            return Promise.resolve(true);
        });
        this.homey.flow.getConditionCard('singlesocket_switch_turned_on').registerRunListener((args, state) => {
            return Promise.resolve(args.device.getCapabilityValue('switch.1') === true);
        });
        this.homey.flow.getActionCard('singlesocket_switch_action').registerRunListener((args, state) => {
            let valueToSend;
            switch (args.state) {
                case 'state_toggle':
                    valueToSend = 'TOGGLE';
                    break;
                case 'state_on':
                    valueToSend = 'ON';
                    break;
                case 'state_off':
                    valueToSend = 'OFF';
                    break;
                default:
                    return Promise.resolve(false);
            }
            args.device.sendTasmotaPowerCommand('1', valueToSend);
            return Promise.resolve(true);
        });
        this.homey.flow.getActionCard('zigbee_pair_action').registerRunListener((args, state) => {
            let valueToSend;
            switch (args.permission) {
                case 'true':
                    valueToSend = '1';
                    break;
                case 'false':
                    valueToSend = '0';
                    break;
                default:
                    return Promise.resolve(false);
            }
            args.device.sendMessage('ZbPermitJoin', valueToSend);
            return Promise.resolve(true);
        });
    }

    onMapDeviceClass(device) {
        this.log(`Mapping device "${device.getName()}"`);
        // Sending SetOption59 to improve tele/* update behaviour for some HA implementation
        let settings = device.getSettings();
        let topic = settings.mqtt_topic;
        let command = 'SetOption59';
        if (settings.swap_prefix_topic)
            topic = topic + '/cmnd/' + command;
        else
            topic = 'cmnd/' + topic + '/' + command;
        this.sendMessage(topic, '1');
        return TasmotaDevice;
    }

    pairingStarted() {
        this.log('pairingStarted called');
        this.sendMessage('cmnd/sonoffs/Status', '0');
        this.sendMessage('cmnd/tasmotas/Status', '0');
        this.sendMessage('sonoffs/cmnd/Status', '0');
        this.sendMessage('tasmotas/cmnd/Status', '0');
        return true;
    }

    getDefaultIcon(settings, capabilities) {
        if (capabilities.includes('zigbee_pair'))
            return 'zigbee_bridge.svg';
        if (capabilities.includes('multiplesockets'))
            return 'extension_plug.svg';
        if (capabilities.includes('windowcoverings_state'))
            return 'curtains.svg';
        if (capabilities.includes('singlesocket')) {
            if (capabilities.includes('fan_speed'))
                return 'table_fan.svg';
            if (capabilities.includes('dim'))
                return 'lightbulb.svg';
            return 'electrical_outlet_1.svg';
        }
        if (capabilities.includes('additional_sensors'))
            return 'sensor.svg';
        return 'tasmota.svg';
    }

    collectedDataToDevice(deviceTopic, messages, swapPrefixTopic) {
        this.log(`collectedDataToDevice: ${JSON.stringify(deviceTopic)} => ${JSON.stringify(messages)}`);
        let devItem = {
            name: "",
            settings: {
                mqtt_topic: deviceTopic,
                swap_prefix_topic: swapPrefixTopic,
                relays_number: '0',
                is_dimmable: 'No',
                has_lighttemp: 'No',
                has_lightcolor: 'No',
                has_fan: 'No',
                shutters_number: '0',
                chip_type: 'unknown',
                additional_sensors: ""
            },
            capabilities: [],
            capabilitiesOptions: {},
            class: 'other',
            data: {},
            icon: ""
        };
        if (('StatusMQT' in messages) && (messages['StatusMQT'][0]['MqttClient'] !== undefined))
            devItem.data = {id: messages['StatusMQT'][0]['MqttClient']};
        else
            return null;
        let isZigbeeBridge = false;
        if ('Status' in messages) {
            if (messages['Status'][0]['DeviceName'] !== undefined)
                devItem.name = messages['Status'][0]['DeviceName'];
            else if (messages['Status'][0]['FriendlyName'] !== undefined)
                devItem.name = messages['Status'][0]['FriendlyName'][0];
            else
                devItem.name = deviceTopic;
            if (messages['Status'][0]['Module'] !== undefined) {
                if (messages['Status'][0]['Module'] === 75) {
                    devItem.capabilities.push('zigbee_pair');
                    isZigbeeBridge = true;
                }
            }
        }
        if (('StatusFWR' in messages) && (messages['StatusFWR'][0]['Hardware'] !== undefined))
            devItem.settings.chip_type = messages['StatusFWR'][0]['Hardware'];
        let shutters = 0;
        if ('StatusSNS' in messages) {
            // Sensors and shutters
            let sensors_settings = {};
            Sensor.forEachSensorValue(messages['StatusSNS'][0], (path, value) => {
                let sensorField = path[path.length - 1];
                let sensor = "";
                if (path.length > 1)
                    sensor = path[path.length - 2];
                let capObj = Sensor.getPropertyObjectForSensorField(path, 'wired', false, sensor);
                this.log(`collectedDataToDevice: ${JSON.stringify(path)} => ${JSON.stringify(capObj)}`);
                if (capObj !== null) {
                    this.log(`getPropertyObjectForSensorField: ${JSON.stringify(capObj)}`);
                    devItem.capabilities.push(capObj.capability);
                    let capSettings = {};
                    if (capObj.units) {
                        let units = capObj.units.default;
                        const units_field = capObj.units.units_field;
                        if ((units_field !== null) && (units_field in messages['StatusSNS'][0]))
                            units = messages['StatusSNS'][0][units_field];
                        units = capObj.units.units_template.replace('{value}', units);
                        capSettings['units'] = {en: units};
                    }
                    if (capObj.caption)
                        capSettings['title'] = {en: capObj.caption};
                    if (Object.keys(capSettings).length > 0)
                        devItem.capabilitiesOptions[capObj.capability] = capSettings;
                    if (sensorField in sensors_settings)
                        sensors_settings[sensorField] = sensors_settings[sensorField] + 1;
                    else
                        sensors_settings[sensorField] = 1;
                } else if (sensor.startsWith('Shutter')) {
                    shutters++;
                }
            }, this.debug);
            if (Object.keys(sensors_settings).length > 0) {
                devItem.capabilities.push('additional_sensors');
                let sens_string = [];
                for (const sitem in sensors_settings)
                    if (sensors_settings[sitem] > 1)
                        sens_string.push(sitem + ' (x' + sensors_settings[sitem] + ')');
                    else
                        sens_string.push(sitem);
                devItem.settings.additional_sensors = sens_string.join(', ');
                devItem.class = 'sensor';
            }
            if (shutters > 0) {
                // Only Shutter1 supported
                devItem.capabilities.push('windowcoverings_state');
                devItem.capabilities.push('windowcoverings_set');
                devItem.settings.shutters_number = shutters.toString();
                devItem.class = 'blinds';
            }
        }
        if ('StatusSTS' in messages) {
            // main section
            let relaysCount = 0;
            if (shutters === 0) {
                // Search for switches only if there is no shutters
                relaysCount = Object.keys(messages['StatusSTS'][0]).filter(function (key) {
                    return key.startsWith('POWER');
                }).length;
                for (let propIndex = 1; propIndex <= relaysCount; propIndex++) {
                    let capId = 'switch.' + propIndex.toString();
                    devItem.capabilities.push(capId);
                    devItem.capabilitiesOptions[capId] = {title: {en: 'switch ' + propIndex.toString()}};
                }
                if (relaysCount > 0) {
                    devItem.capabilities.push('onoff');
                    devItem.capabilities.push(relaysCount > 1 ? 'multiplesockets' : 'singlesocket');
                }
            }
            devItem.settings.relays_number = relaysCount.toString();
            if (relaysCount === 1) {
                devItem.class = 'socket';
                if ('Dimmer' in messages['StatusSTS'][0]) {
                    devItem.class = 'light';
                    devItem.settings.is_dimmable = 'Yes';
                    devItem.capabilities.push('dim');
                }
                let lmCounter = 0;
                if ('CT' in messages['StatusSTS'][0]) {
                    devItem.capabilities.push('light_temperature');
                    devItem.settings.has_lighttemp = 'Yes';
                    lmCounter++;
                }
                if ('HSBColor' in messages['StatusSTS'][0]) {
                    devItem.capabilities.push('light_hue');
                    devItem.capabilities.push('light_saturation');
                    devItem.settings.has_lightcolor = 'Yes';
                    lmCounter++;
                }
                if (lmCounter === 2)
                    devItem.capabilities.push('light_mode');
                if ('FanSpeed' in messages['StatusSTS'][0]) {
                    devItem.class = 'fan';
                    devItem.capabilities.push('fan_speed');
                    devItem.settings.has_fan = 'Yes';
                }
            } else if (relaysCount > 1)
                devItem.class = 'other';
        }
        if (isZigbeeBridge)
            devItem.class = 'other';
        // Should be the last one
        devItem.capabilities.push('measure_signal_strength');
        devItem.icon = '../../../assets/icons/devices/' + this.getDefaultIcon(devItem.settings, devItem.capabilities);
        if (devItem.capabilities.length <= 1)
            return null;
        return devItem;
    }

    pairingFinished(messagesCollected) {
        this.log('pairingFinished called');
        let devices = [];
        Object.keys(messagesCollected).sort().forEach(key => {
            let devItem = this.collectedDataToDevice(key, messagesCollected[key].messages, messagesCollected[key].swapPrefixTopic);
            if (devItem !== null)
                devices.push(devItem);
        });
        this.log(`pairingFinished: devices found ${JSON.stringify(devices)}`);
        return devices;
    }
}

module.exports = TasmotaDeviceDriver;

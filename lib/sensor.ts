export default class Sensor {

    static WiredSensorCapabilities: any = {
        'CapabilitiesTemplates': {
            'Temperature': [
                {
                    sensor_filter: '*',
                    caption: 'Temperature ({sensor})',
                    capability: 'measure_temperature.{sensor}',
                    value_converter: null,
                    units: {default: 'C', units_field: 'TempUnit', units_template: '°{value}'}
                },
            ],
            'Humidity': [
                {
                    sensor_filter: '*',
                    caption: 'Humidity ({sensor})',
                    capability: 'measure_humidity.{sensor}',
                    value_converter: null,
                    units: {default: '%', units_field: null, units_template: '{value}'}
                },
            ],
            'DewPoint': [
                {
                    sensor_filter: '*',
                    caption: 'Dew point ({sensor})',
                    capability: 'measure_temperature.dew_point.{sensor}',
                    value_converter: null,
                    units: {default: 'C', units_field: 'TempUnit', units_template: '°{value}'}
                },
            ],
            'Pressure': [
                {
                    sensor_filter: '*',
                    caption: 'Pressure ({sensor})',
                    capability: 'measure_pressure.{sensor}',
                    value_converter: null,
                    units: {default: 'hPa', units_field: 'PressureUnit', units_template: '{value}'}
                },
            ],
            'CarbonDioxide': [
                {
                    sensor_filter: '*',
                    caption: 'Carbon dioxide ({sensor})',
                    capability: 'measure_co2.{sensor}',
                    value_converter: null,
                    units: {default: 'ppm', units_field: null, units_template: '{value}'}
                },
            ],
            'Illuminance': [
                {
                    sensor_filter: '*',
                    caption: 'Illuminance ({sensor})',
                    capability: 'measure_luminance.{sensor}',
                    value_converter: null,
                    units: {default: 'lx', units_field: null, units_template: '{value}'}
                },
            ],
            'CF1': [
                {
                    sensor_filter: '*',
                    caption: 'CF1 ({sensor})',
                    capability: 'measure_particulate_matter.cf1.{sensor}',
                    value_converter: null,
                    units: {default: 'µg/m³', units_field: null, units_template: '{value}'}
                },
            ],
            'CF2.5': [
                {
                    sensor_filter: '*',
                    caption: 'CF2.5 ({sensor})',
                    capability: 'measure_particulate_matter.cf2_5.{sensor}',
                    value_converter: null,
                    units: {default: 'µg/m³', units_field: null, units_template: '{value}'}
                },
            ],
            'CF10': [
                {
                    sensor_filter: '*',
                    caption: 'CF10 ({sensor})',
                    capability: 'measure_particulate_matter.cf10.{sensor}',
                    value_converter: null,
                    units: {default: 'µg/m³', units_field: null, units_template: '{value}'}
                },
            ],
            'PM1': [
                {
                    sensor_filter: '*',
                    caption: 'PM1 ({sensor})',
                    capability: 'measure_particulate_matter.pm1.{sensor}',
                    value_converter: null,
                    units: {default: 'ppd', units_field: null, units_template: '{value}'}
                },
            ],
            'PM2.5': [
                {
                    sensor_filter: '*',
                    caption: 'PM2.5 ({sensor})',
                    capability: 'measure_particulate_matter.pm2_5.{sensor}',
                    value_converter: null,
                    units: {default: 'ppd', units_field: null, units_template: '{value}'}
                },
            ],
            'PM10': [
                {
                    sensor_filter: '*',
                    caption: 'PM10 ({sensor})',
                    capability: 'measure_particulate_matter.pm10.{sensor}',
                    value_converter: null,
                    units: {default: 'ppd', units_field: null, units_template: '{value}'}
                },
            ],
            'PB0.3': [
                {
                    sensor_filter: '*',
                    caption: 'PB0.3 ({sensor})',
                    capability: 'measure_particulate_matter.pb0_3.{sensor}',
                    value_converter: null,
                    units: {default: 'ppd', units_field: null, units_template: '{value}'}
                },
            ],
            'PB0.5': [
                {
                    sensor_filter: '*',
                    caption: 'PB0.5 ({sensor})',
                    capability: 'measure_particulate_matter.pb0_5.{sensor}',
                    value_converter: null,
                    units: {default: 'ppd', units_field: null, units_template: '{value}'}
                },
            ],
            'PB1': [
                {
                    sensor_filter: '*',
                    caption: 'PB1 ({sensor})',
                    capability: 'measure_particulate_matter.pb1.{sensor}',
                    value_converter: null,
                    units: {default: 'ppd', units_field: null, units_template: '{value}'}
                },
            ],
            'PB2.5': [
                {
                    sensor_filter: '*',
                    caption: 'PB2.5 ({sensor})',
                    capability: 'measure_particulate_matter.pb2_5.{sensor}',
                    value_converter: null,
                    units: {default: 'ppd', units_field: null, units_template: '{value}'}
                },
            ],
            'PB5': [
                {
                    sensor_filter: '*',
                    caption: 'PB5 ({sensor})',
                    capability: 'measure_particulate_matter.pb5.{sensor}',
                    value_converter: null,
                    units: {default: 'ppd', units_field: null, units_template: '{value}'}
                },
            ],
            'PB10': [
                {
                    sensor_filter: '*',
                    caption: 'PB10 ({sensor})',
                    capability: 'measure_particulate_matter.pb10.{sensor}',
                    value_converter: null,
                    units: {default: 'ppd', units_field: null, units_template: '{value}'}
                },
            ],
            'UvLevel': [
                {
                    sensor_filter: '*',
                    caption: 'UV index ({sensor})',
                    capability: 'measure_ultraviolet.{sensor}',
                    value_converter: null,
                    units: null
                },
            ],
            'Frequency': [
                {
                    sensor_filter: '*',
                    caption: 'Frequency ({sensor})',
                    capability: 'measure_frequency.{sensor}',
                    value_converter: null,
                    units: {default: 'Hz', units_field: null, units_template: '{value}'}
                },
            ],
            'Voltage': [
                {
                    sensor_filter: 'ENERGY',
                    caption: 'Voltage',
                    capability: 'measure_voltage',
                    value_converter: null,
                    units: {default: 'V', units_field: null, units_template: '{value}'}
                },
                {
                    sensor_filter: '*',
                    caption: 'Voltage ({sensor})',
                    capability: 'measure_voltage.{sensor}',
                    value_converter: null,
                    units: {default: 'V', units_field: null, units_template: '{value}'}
                },
            ],
            'Current': [
                {
                    sensor_filter: 'ENERGY',
                    caption: 'Current',
                    capability: 'measure_current',
                    value_converter: null,
                    units: {default: 'A', units_field: null, units_template: '{value}'}
                },
                {
                    sensor_filter: '*',
                    caption: 'Current ({sensor})',
                    capability: 'measure_current.{sensor}',
                    value_converter: null,
                    units: {default: 'A', units_field: null, units_template: '{value}'}
                },
            ],
            'Power': [
                {
                    sensor_filter: 'ENERGY',
                    caption: 'Power',
                    capability: 'measure_power',
                    value_converter: null,
                    units: {default: 'W', units_field: null, units_template: '{value}'}
                },
                {
                    sensor_filter: '*',
                    caption: 'Power ({sensor})',
                    capability: 'measure_power.{sensor}',
                    value_converter: null,
                    units: {default: 'W', units_field: null, units_template: '{value}'}
                },
            ],
            'Factor': [
                {
                    sensor_filter: 'ENERGY',
                    caption: 'Power factor',
                    capability: 'measure_power_factor',
                    value_converter: null,
                    units: null
                },
                {
                    sensor_filter: '*',
                    caption: 'Power factor ({sensor})',
                    capability: 'measure_power_factor.{sensor}',
                    value_converter: null,
                    units: null
                },
            ],
            'ApparentPower': [
                {
                    sensor_filter: 'ENERGY',
                    caption: 'Apparent power',
                    capability: 'measure_apparent_power',
                    value_converter: null,
                    units: {default: 'VA', units_field: null, units_template: '{value}'}
                },
                {
                    sensor_filter: '*',
                    caption: 'Apparent power ({sensor})',
                    capability: 'measure_apparent_power.{sensor}',
                    value_converter: null,
                    units: {default: 'VA', units_field: null, units_template: '{value}'}
                },
            ],
            'ReactivePower': [
                {
                    sensor_filter: 'ENERGY',
                    caption: 'Reactive power',
                    capability: 'measure_power_reactive',
                    value_converter: null,
                    units: {default: 'VAr', units_field: null, units_template: '{value}'}
                },
                {
                    sensor_filter: '*',
                    caption: 'Reactive power ({sensor})',
                    capability: 'measure_power_reactive.{sensor}',
                    value_converter: null,
                    units: {default: 'VAr', units_field: null, units_template: '{value}'}
                },
            ],
            'Total': [
                {
                    sensor_filter: 'ENERGY',
                    caption: 'Power meter',
                    capability: 'meter_power',
                    value_converter: null,
                    units: {default: 'kWh', units_field: null, units_template: '{value}'}
                },
                {
                    sensor_filter: '*',
                    caption: 'Power meter ({sensor})',
                    capability: 'meter_power.{sensor}',
                    value_converter: null,
                    units: {default: 'kWh', units_field: null, units_template: '{value}'}
                },
            ],
            'Today': [
                {
                    sensor_filter: 'ENERGY',
                    caption: 'Power meter today',
                    capability: 'meter_energy_today',
                    value_converter: null,
                    units: {default: 'kWh', units_field: null, units_template: '{value}'}
                },
                {
                    sensor_filter: '*',
                    caption: 'Power meter today ({sensor})',
                    capability: 'meter_energy_today.{sensor}',
                    value_converter: null,
                    units: {default: 'kWh', units_field: null, units_template: '{value}'}
                },
            ],
            'Yesterday': [
                {
                    sensor_filter: 'ENERGY',
                    caption: 'Power meter yesterday',
                    capability: 'meter_energy_yesterday',
                    value_converter: null,
                    units: {default: 'kWh', units_field: null, units_template: '{value}'}
                },
                {
                    sensor_filter: '*',
                    caption: 'Power meter yesterday ({sensor})',
                    capability: 'meter_energy_yesterday.{sensor}',
                    value_converter: null,
                    units: {default: 'kWh', units_field: null, units_template: '{value}'}
                },
            ],
            'SeaPressure': [
                {
                    sensor_filter: '*',
                    caption: 'Sea level pressure ({sensor})',
                    capability: 'measure_pressure.see_level.{sensor}',
                    value_converter: null,
                    units: {default: 'hPa', units_field: 'PressureUnit', units_template: '{value}'}
                },
            ],
            'TVOC': [
                {
                    sensor_filter: '*',
                    caption: 'TVOC ({sensor})',
                    capability: 'measure_tvoc.{sensor}',
                    value_converter: null,
                    units: {default: 'ppb', units_field: null, units_template: '{value}'}
                },
            ],
            'eCO2': [
                {
                    sensor_filter: '*',
                    caption: 'Equivalent CO\u2082 ({sensor})',
                    capability: 'measure_co2.eco2.{sensor}',
                    value_converter: null,
                    units: {default: 'ppm', units_field: null, units_template: '{value}'}
                },
            ],
            'A': [
                {
                    sensor_filter: '*',
                    caption: 'Analog {index} ({sensor})',
                    capability: 'measure_analog.{sensor}.{index}',
                    value_converter: null,
                    units: null
                },
            ],
            'Switch': [
                {
                    sensor_filter: '*',
                    caption: 'Switch {index}',
                    capability: 'sensor_switch.{index}',
                    value_converter: this.convertOnOffToBool,
                    units: null
                },
            ],
            'C': [
                {
                    sensor_filter: 'COUNTER',
                    caption: 'Counter {index}',
                    capability: 'sensor_counter.{index}',
                    value_converter: null,
                    units: null
                },
            ],
        },
        'Cache': {}
    }
    static ZigbeeSensorCapabilities = {
        'CapabilitiesTemplates': {
            'Temperature': [
                {
                    sensor_filter: '*',
                    caption: null,
                    capability: 'measure_temperature',
                    value_converter: null,
                    units: null,
                    icon: 'temperature'
                },
            ],
            'Humidity': [
                {sensor_filter: '*', caption: null, capability: 'measure_humidity', value_converter: null, units: null},
            ],
            'Pressure': [
                {sensor_filter: '*', caption: null, capability: 'measure_pressure', value_converter: null, units: null},
            ],
            'BatteryPercentage': [
                {sensor_filter: '*', caption: null, capability: 'measure_battery', value_converter: null, units: null},
            ],
            'LinkQuality': [
                {
                    sensor_filter: '*',
                    caption: null,
                    capability: 'measure_signal_strength',
                    value_converter: this.LinkQualityToPercentage,
                    units: null
                },
            ],
            '0500<00': [
                {
                    sensor_filter: '*',
                    caption: null,
                    capability: 'alarm_water',
                    value_converter: this.WaterAlarmConverter,
                    units: null,
                    icon: 'water_leak'
                },
            ],
            'Illuminance': [
                {
                    sensor_filter: '*',
                    caption: null,
                    capability: 'measure_luminance',
                    value_converter: null,
                    units: null
                },
            ],
            'Occupancy': [
                {
                    sensor_filter: '*',
                    caption: null,
                    capability: 'alarm_motion',
                    value_converter: this.BinaryToBool,
                    units: null,
                    icon: 'motion_sensor'
                },
            ],
            'Contact': [
                {
                    sensor_filter: '*',
                    caption: null,
                    capability: 'alarm_contact',
                    value_converter: this.BinaryToBool,
                    units: null,
                    icon: 'door_sensor'
                },
            ]
        },
        'Cache': {}
    }
    static sensorNameRegExp = new RegExp('^(?<name>.+)(?<index>[0-9]+)$');

    static convertOnOffToBool(value: string) {
        return value === 'ON';
    }

    static LinkQualityToPercentage(value: number) {
        return Math.ceil(value * 100 / 254);
    }

    static WaterAlarmConverter(value: any) {
        return value === "010000FF0000";
    }

    static BinaryToBool(value: any) {
        return value === "1";
    }

    static forEachSensorValue(root: any, lambda: any, debug: boolean) {
        let paths = [];
        let nodes = [{
            obj: root,
            path: []
        }];
        while (nodes.length > 0) {
            let node = nodes.pop();
            if (!node) return;
            try {
                Object.keys(node?.obj).forEach((k: any) => {
                    let path = node?.path.concat(k) ?? [];
                    let value = node?.obj[k];
                    if ((value !== null) && (typeof value === 'object')) {

                        paths.push(path);
                        nodes.unshift({
                            obj: value,
                            path: path
                        });
                    } else {
                        lambda(path, value);
                    }
                });
            } catch (error) {
                if (debug) throw(error);
            }

        }
    };

    static getCapabilitiesObjectByType(capType: string) {
        switch (capType) {
            case 'wired':
                return this.WiredSensorCapabilities;
            case 'zigbee':
                return this.ZigbeeSensorCapabilities;
            default:
                return null;
        }
    }


    static parseSensorValueName(stringName: string) {
        let regExpRes = this.sensorNameRegExp.exec(stringName);
        if (regExpRes !== null && regExpRes.groups !== undefined) {
            return {name: regExpRes.groups.name, index: regExpRes.groups.index};
        } else
            return null;
    }


    static getPropertyObjectForSensorField(path: string[], sensor_type: string, cache_result: boolean, sensor?: any) {
        if (sensor_type === undefined)
            sensor_type = 'wired';
        if (cache_result === undefined)
            cache_result = true;
        if (!sensor)
            sensor = path.length >= 2 ? path[path.length - 2] : 'unknown';
        let propObject = this.getCapabilitiesObjectByType(sensor_type);
        if (!propObject)
            return null;
        let recId = path.join('.');
        let result: any = null;
        if (recId in propObject.Cache)
            result = propObject.Cache[recId];
        else {
            let valueField = path[path.length - 1];
            let filters = [];
            let valueIndex = "";
            let valueType = "";
            if (valueField in propObject.CapabilitiesTemplates) {
                valueType = valueField;
                filters = propObject.CapabilitiesTemplates[valueType];
            } else {
                let parseRes = this.parseSensorValueName(valueField);
                if ((parseRes !== null) && (parseRes.name in propObject.CapabilitiesTemplates)) {
                    valueType = parseRes.name;
                    valueIndex = parseRes.index;
                    filters = propObject.CapabilitiesTemplates[valueType];
                }
            }
            let filtersCount = filters.length;
            for (let filterIndex = 0; filterIndex < filtersCount; filterIndex++) {
                if ((filters[filterIndex].sensor_filter === '*') || (filters[filterIndex].sensor_filter === sensor) || sensor.startsWith(filters[filterIndex].sensor_filter + '-')) {
                    result = {};
                    Object.assign(result, filters[filterIndex]);
                    if (result.caption)
                        result.caption = result.caption.replace('{index}', valueIndex).replace('{sensor}', sensor);
                    result.capability = result.capability.replace('{index}', valueIndex).replace('{sensor}', sensor);
                    result.cached = false;
                    break;
                }
            }
            if (cache_result) {
                if (result !== null) {
                    propObject.Cache[recId] = {};
                    Object.assign(propObject.Cache[recId], result);
                    propObject.Cache[recId].cached = true;
                } else
                    propObject.Cache[recId] = null;
            }
        }
        return result;
    }
}


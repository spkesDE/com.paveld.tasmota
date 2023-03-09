'use strict';

const Homey = require('homey');
const fs = require('fs');
const https = require('https');

const latestTasmotaReleaseFilename = './userdata/tasmota.ver';

class TasmotaMqttApp extends Homey.App {
    makeHttpsRequest(options, timeout) {
        return new Promise((resolve, reject) => {
            const request = https.request(options, (res) => {
                let resBody = '';
                res.on('data', (chunk) => {
                    resBody += chunk;
                });
                res.once('end', () => {
                    res.body = resBody;
                    return resolve(res); // resolve the request
                });
            });
            request.setTimeout(timeout || this.timeout, () => {
                request.destroy();
            });
            request.once('error', (e) => {
                this.lastResponse = e;  // e.g. ECONNREFUSED on wrong port or wrong IP // ECONNRESET on wrong IP
                return reject(e);
            });
            request.end();
        });
    }

    parseVersionString(versionString) {
        const match = versionString.match(/^v(?<major>\d+)\.(?<minor>\d+)\.(?<revision>\d+)$/);
        if (match === null)
            return null;
        return {major: match.groups.major, minor: match.groups.minor, revision: match.groups.revision}
    }

    async getLatestTasmotaVersion() {
        try {
            const result = await this.makeHttpsRequest({
                host: 'api.github.com',
                path: '/repos/arendst/tasmota/releases/latest',
                method: 'GET',
                headers: {
                    'user-agent': 'node.js'
                }
            }, 2000).catch((error) => {
                this.log(`makeHttpsRequest error: ${error}`);
            });
            if (result.statusCode !== 200)
                throw new Error(`Error while checking tasmota releases, staus: ${result.statusCode}`);
            const info = JSON.parse(result.body);
            const version = this.parseVersionString(info.tag_name);
            if (version !== null)
                this.log(`getLatestTasmotaVersion: Version: ${version.major}.${version.minor}.${version.revision}`);
            return version;
        } catch (error) {
            this.log(error);
            return null;
        }
    }

    saveTasmotaVersion(version) {
        try {
            fs.writeFileSync(latestTasmotaReleaseFilename, `v${version.major}.${version.minor}.${version.revision}`, {encoding: 'utf8'});
        } catch (error) {
            this.log('Error writing tasmota version file: ' + error);
        }
    }

    loadTasmotaVersion() {
        try {
            if (!fs.existsSync(latestTasmotaReleaseFilename)) {
                this.log('loadTasmotaVersion: No version file exists!');
                return null;
            }
            let tempStr = fs.readFileSync(latestTasmotaReleaseFilename, {encoding: 'utf8'});
            return this.parseVersionString(tempStr);
        } catch (error) {
            return null;
        }
    }

    async checkTasmotaReleases() {
        try {
            let newVersion = await this.getLatestTasmotaVersion();
            if (newVersion !== null) {
                let saveVersion = false;
                if (this.lastTasmotaVersion === null) {
                    this.log(`Latest Tasmota release detected ${newVersion.major}.${newVersion.minor}.${newVersion.revision} (no saved version found)`);
                    saveVersion = true;
                } else {
                    let updateAvailable = (this.lastTasmotaVersion.major < newVersion.major) ||
                        (this.lastTasmotaVersion.major === newVersion.major) && (this.lastTasmotaVersion.minor < newVersion.minor) ||
                        (this.lastTasmotaVersion.major === newVersion.major) && (this.lastTasmotaVersion.minor === newVersion.minor) && (this.lastTasmotaVersion.revision < newVersion.revision);
                    if (updateAvailable) {
                        await this.tasmotaUpdateTrigger.trigger({
                            new_major: newVersion.major,
                            new_minor: newVersion.minor,
                            new_revision: newVersion.revision,
                            old_major: this.lastTasmotaVersion.major,
                            old_minor: this.lastTasmotaVersion.minor,
                            old_revision: this.lastTasmotaVersion.revision
                        });
                        saveVersion = true;
                        this.log(`New Tasmota version available ${newVersion.major}.${newVersion.minor}.${newVersion.revision} (old ${this.lastTasmotaVersion.major}.${this.lastTasmotaVersion.minor}.${this.lastTasmotaVersion.revision})`);
                    }
                }
                if (saveVersion) {
                    this.saveTasmotaVersion(newVersion);
                    this.lastTasmotaVersion = newVersion;
                }
            }
        } catch (error) {
            this.log(`checkTasmotaReleases: ${error}`);
        }
    }

    connectMqttClient() {
        this.MQTTClient = this.homey.api.getApiApp('nl.scanno.mqtt');
        this.MQTTClient
            .on('install', () => this.register())
            .on('uninstall', () => this.unregister())
            .on('realtime', (topic, message) => {
                this.onMessage(topic, message);
            });
        try {
            this.MQTTClient.getInstalled()
                .then(installed => {
                    this.clientAvailable = installed;
                    this.log(`MQTT client status: ${this.clientAvailable}`);
                    if (installed) {
                        this.register();
                        this.homey.apps.getVersion(this.MQTTClient).then((version) => {
                            this.log(`MQTT client installed, version: ${version}`);
                        });
                    }
                }).catch((error) => {
                this.log(`MQTT client app error: ${error}`);
            });
        } catch (error) {
            this.log(`MQTT client app error: ${error}`);
        }

    }

    getAllFiles(dirPath, arrayOfFiles) {
        let files = fs.readdirSync(dirPath);
        arrayOfFiles = arrayOfFiles || [];
        files.forEach(file => {
            if (fs.statSync(dirPath + "/" + file).isDirectory()) {
                arrayOfFiles = this.getAllFiles(dirPath + "/" + file, arrayOfFiles);
            } else {
                arrayOfFiles.push(dirPath + "/" + file);
            }
        });
        return arrayOfFiles;
    };


    async onInit() {
        try {
            this.applicationVersion = Homey.manifest.version;
            this.debug = process.env.DEBUG == 1;
            this.applicationName = Homey.manifest.name.en;
        } catch (error) {
            this.applicationVersion = undefined;
            this.debug = false;
            this.applicationName = this.constructor.name;
        }
        process.on('unhandledRejection', (reason, p) => {
            this.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
        });
        this.topics = ["stat", "tele"];
        this.drivers = this.homey.drivers.getDrivers();
        this.lastMqttMessage = undefined;
        this.clientAvailable = false;
        this.connectMqttClient();
        this.log(`${this.applicationName} is running. Version: ${this.applicationVersion}, debug: ${this.debug}`);
        if (this.debug)
            this.log(`All files in app: ${this.getAllFiles("/userdata", [])}`);
        this.lastTasmotaVersion = this.loadTasmotaVersion();
        this.tasmotaUpdateTrigger = this.homey.flow.getTriggerCard('new_tasmota_version');
        setTimeout(() => {
            this.checkTasmotaReleases();
            setInterval(() => {
                this.checkTasmotaReleases();
            }, 86400000); // Check for new tasmota releases once per day
        }, 300000);
        this.checkConnection = setInterval(() => {
            try {
                if ((this.lastMqttMessage !== undefined) && (Date.now() - this.lastMqttMessage > 10 * 60 * 1000)) {
                    this.log(`MQTT connection timeout. Resetting connection`);
                    this.lastMqttMessage = undefined;
                    this.connectMqttClient();
                }
            } catch (error) {
                if (this.debug)
                    throw(error);
                else
                    this.log(`${this.constructor.name} checkDevices error: ${error}`);
            }
        }, 60000);

    }

    onMessage(topic, message) {
        let topicParts = topic.split('/');
        if (topicParts.length > 1) {
            this.lastMqttMessage = Date.now();
            let prefixFirst = this.topics.includes(topicParts[0]);
            if (prefixFirst || this.topics.includes(topicParts[1]))
                Object.keys(this.drivers).forEach((driverId) => {
                    this.drivers[driverId].onMessage(topic, message, prefixFirst);
                });
        }
    }

    subscribeTopic(topicName) {
        if (!this.clientAvailable)
            return;
        return this.MQTTClient.post('subscribe', {topic: topicName}, error => {
            if (error) {
                this.log(`Can not subscrive to topic ${topicName}, error: ${error}`)
            } else {
                this.log(`Sucessfully subscribed to topic: ${topicName}`);
            }
        }).catch(error => {
            this.log(`Error while subscribing to ${topicName}. ${error}`);
        });
    }

    sendMessage(topic, payload) {
        this.log(`sendMessage: ${topic} <= ${payload}`);
        if (!this.clientAvailable)
            return;
        this.MQTTClient.post('send', {
            qos: 0,
            retain: false,
            mqttTopic: topic,
            mqttMessage: payload
        }, error => {
            if (error)
                this.log(`Error sending ${topic} <= "${payload}"`);
        }).catch(error => {
            this.log(`Error while sending ${topic} <= "${payload}". ${error}`);
        });
    }

    register() {
        this.clientAvailable = true;
        // Subscribing to system topic to check if connection still alive (update ~10 second for mosquitto)
        this.subscribeTopic("$SYS/broker/uptime");
        this.lastMqttMessage = Date.now();
        for (let topic in this.topics) {
            this.subscribeTopic(this.topics[topic] + "/#");
            this.subscribeTopic("+/" + this.topics[topic] + "/#");
        }
        let now = Date.now();
        Object.keys(this.drivers).forEach((driverId) => {
            this.drivers[driverId].getDevices().forEach((device) => {
                device.nextRequest = now;
            });
            this.drivers[driverId].updateDevices();
        });
    }

    unregister() {
        this.clientAvailable = false;
        this.lastMqttMessage = undefined;
        this.log(`${this.constructor.name} unregister called`);
    }

}

module.exports = TasmotaMqttApp;

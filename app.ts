import Homey from 'homey';
import TasmotaVersionChecker from "./tasmotaVersionChecker";

export default class TasmotaMqttApp extends Homey.App {
    private MQTTClient: any;
    clientAvailable: boolean = false;
    private applicationVersion: any;
    debug: boolean = false;
    private applicationName: string = 'TasmotaMqtt';
    private versionChecker!: TasmotaVersionChecker;
    private topics: string[] = [];
    private drivers: { [p: string]: any } = {};
    private lastMqttMessage: any;
    private checkConnection!: NodeJS.Timeout;

    connectMqttClient() {
        this.MQTTClient = this.homey.api.getApiApp('nl.scanno.mqtt');
        this.MQTTClient
            .on('install', () => this.register())
            .on('uninstall', () => this.unregister())
            .on('realtime', (topic: any, message: any) => {
                this.onMessage(topic, message);
            });
        try {
            this.MQTTClient.getInstalled()
                .then((installed: any) => {
                    this.clientAvailable = installed;
                    this.log(`MQTT client status: ${this.clientAvailable}`);
                    if (installed) {
                        this.register();
                        this.homey.apps.getVersion(this.MQTTClient).then((version) => {
                            this.log(`MQTT client installed, version: ${version}`);
                        });
                    }
                }).catch((error: Error) => {
                this.log(`MQTT client app error: ${error}`);
            });
        } catch (error) {
            this.log(`MQTT client app error: ${error}`);
        }

    }


    async onInit() {
        try {
            this.applicationVersion = Homey.manifest.version;
            this.debug = !!process.env.DEBUG;
            this.applicationName = Homey.manifest.name.en
        } catch (error) {
            this.applicationVersion = undefined;
            this.debug = false;
            this.applicationName = this.constructor.name;
        }
        process.on('unhandledRejection', (reason, p) => {
            this.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
        });

        //Start version checker to see if a new version is available and if so trigger a flow.
        this.versionChecker = new TasmotaVersionChecker(this);

        //Setup MQTT client
        this.topics = ["stat", "tele"];
        this.drivers = this.homey.drivers.getDrivers();
        this.lastMqttMessage = undefined;
        this.clientAvailable = false;
        this.connectMqttClient();
        this.log(`${this.applicationName} is running. Version: ${this.applicationVersion}, debug: ${this.debug}`);
        if (this.debug)
            this.log(`All files in app: ${this.versionChecker.getAllFiles("/userdata", [])}`);
        this.checkConnection = this.homey.setInterval(() => {
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

    onMessage(topic: string, message: string) {
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

    subscribeTopic(topicName: string) {
        if (!this.clientAvailable)
            return;
        return this.MQTTClient.post('subscribe', {topic: topicName}, (error: Error) => {
            if (error) {
                this.log(`Can not subscribe to topic ${topicName}, error: ${error}`)
            } else {
                this.log(`Successfully subscribed to topic: ${topicName}`);
            }
        }).catch((error: Error) => {
            this.log(`Error while subscribing to ${topicName}. ${error}`);
        });
    }

    sendMessage(topic: string, payload: string) {
        this.log(`sendMessage: ${topic} <= ${payload}`);
        if (!this.clientAvailable)
            return;
        this.MQTTClient.post('send', {
            qos: 0,
            retain: false,
            mqttTopic: topic,
            mqttMessage: payload
        }, (error: Error) => {
            if (error)
                this.log(`Error sending ${topic} <= "${payload}"`);
        }).catch((error: Error) => {
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
            this.drivers[driverId].getDevices().forEach((device: any) => {
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

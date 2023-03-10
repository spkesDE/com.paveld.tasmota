import Homey, {ApiApp} from 'homey';
import TasmotaVersionChecker from "./tasmotaVersionChecker";

export default class TasmotaMqttApp extends Homey.App {
    private MQTTClient!: ApiApp;
    clientAvailable: boolean = false;
    private applicationVersion: any;
    debug: boolean = false;
    private applicationName: string = 'TasmotaMqtt';
    private versionChecker!: TasmotaVersionChecker;
    private topics: string[] = [];
    private drivers: any = {};
    private lastMqttMessage: any;
    private checkConnectionInterval!: NodeJS.Timeout;

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
        let result = await this.connectMqttClient().catch(this.error);
        if (!result) {
            this.error("Failed to connect to MQTT.");
        }
        //Logging for startup
        this.log(`${this.applicationName} is running. Version: ${this.applicationVersion}, debug: ${this.debug}`);
        if (this.debug)
            this.log(`All files in app: ${this.versionChecker.getAllFiles("/userdata", [])}`);

        //Starting interval to check connection of the MQTT client
        this.checkConnection();

    }

    public onMessage(topic: string, message: string) {
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

    public subscribeToTopic(topicName: string) {
        if (!this.clientAvailable) return;
        this.MQTTClient.post('subscribe', {topic: topicName})
            .then(() =>
                this.log(`Successfully subscribed to topic: ${topicName}`)
            )
            .catch((error: Error) =>
                this.log(`Can not subscribe to topic ${topicName}, error: ${error}`)
            );
    }

    public sendMessage(topic: string, payload: string) {
        this.log(`sendMessage: ${topic} <= ${payload}`);
        if (!this.clientAvailable)
            return;
        this.MQTTClient.post('send', {
            qos: 0,
            retain: false,
            mqttTopic: topic,
            mqttMessage: payload
        }).catch((error: Error) => {
            this.log(`Error while sending ${topic} <= "${payload}". ${error}`);
        });
    }

    private checkConnection() {
        this.checkConnectionInterval = this.homey.setInterval(async () => {
            if ((this.lastMqttMessage !== undefined && (Date.now() - this.lastMqttMessage > 10 * 60 * 1000)) || !this.clientAvailable) {
                this.log(`MQTT connection timeout. Resetting connection`);
                this.lastMqttMessage = undefined;
                await this.connectMqttClient();
            }
        }, 1000 * 60);
    }

    private async connectMqttClient(): Promise<boolean> {
        return new Promise(async (resolve) => {
            this.MQTTClient = this.homey.api.getApiApp('nl.scanno.mqtt') as ApiApp;
            if (this.MQTTClient == undefined) {
                this.log("MQTT client not found");
                resolve(false);
            }
            if (!await this.MQTTClient.getInstalled().catch(this.error)) {
                this.log("MQTT not installed");
                await this.homey.notifications.createNotification({
                    excerpt: "MQTT not installed. Please install MQTT Client to use Tasmota MQTT. (https://homey.app/a/nl.scanno.mqtt/)",
                })
                resolve(false);
            }
            this.MQTTClient
                .on('install', () => this.register())
                .on('uninstall', () => this.unregister())
                .on('realtime', (topic: any, message: any) => {
                    this.onMessage(topic, message);
                });
            this.clientAvailable = true;
            this.log(`MQTT client status: ${await this.MQTTClient.getInstalled().catch(this.error)} - ${await this.MQTTClient.getVersion().catch(this.error)}`);
            this.register();
            resolve(true);
        });
    }

    private register() {
        // Subscribing to system topic to check if connection still alive (update ~10 second for mosquitto)
        this.subscribeToTopic("$SYS/broker/uptime");
        this.lastMqttMessage = Date.now();
        for (let topic in this.topics) {
            this.subscribeToTopic(this.topics[topic] + "/#");
            this.subscribeToTopic("+/" + this.topics[topic] + "/#");
        }
        let now = Date.now();
        Object.keys(this.drivers).forEach((driverId) => {
            this.drivers[driverId].getDevices().forEach((device: any) => {
                device.nextRequest = now;
            });
            this.drivers[driverId].updateDevices();
        });
    }

    private unregister() {
        this.clientAvailable = false;
        this.lastMqttMessage = undefined;
        this.log(`${this.constructor.name} unregister called`);
    }

}

module.exports = TasmotaMqttApp;

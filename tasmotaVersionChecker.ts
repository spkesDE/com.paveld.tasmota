import fs from "fs";
import https from "https";
import TasmotaMqttApp from "./app";

const latestTasmotaReleaseFilename = './userdata/tasmota.ver';
export default class TasmotaVersionChecker {
    public app: any;
    public tasmotaUpdateTrigger: any;
    public lastTasmotaVersion: any;
    public log: any;
    public timeout: any;
    public lastResponse: any;

    constructor(app: TasmotaMqttApp) {
        this.app = app;
        this.tasmotaUpdateTrigger = this.app.homey.flow.getTriggerCard('new_tasmota_version');
        this.lastTasmotaVersion = this.loadTasmotaVersion();
        setTimeout(() => {
            this.checkTasmotaReleases().then();
            setInterval(() => {
                this.checkTasmotaReleases().then();
            }, 86400000); // Check for new tasmota releases once per day
        }, 300000);
    }

    parseVersionString(versionString: string) {
        let match = versionString.match(/^v(?<major>\d+)\.(?<minor>\d+)\.(?<revision>\d+)$/);
        if (match === null || match.groups === undefined)
            return null;
        return {major: match.groups.major, minor: match.groups.minor, revision: match.groups.revision}
    }

    getAllFiles(dirPath: string, arrayOfFiles: string[]) {
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

    async getLatestTasmotaVersion() {
        try {
            let result = await this.makeHttpsRequest({
                host: 'api.github.com',
                path: '/repos/arendst/tasmota/releases/latest',
                method: 'GET',
                headers: {
                    'user-agent': 'node.js'
                }
            }, 2000).catch((error) => {
                this.app.log(`makeHttpsRequest error: ${error}`);
            });
            if (!result || result.statusCode !== 200) {
                this.app.error(`Error while checking tasmota releases, staus: ${result?.statusCode}`);
                return null;
            }
            const info = JSON.parse(result.body);
            const version = this.parseVersionString(info.tag_name);
            if (version !== null)
                this.app.log(`getLatestTasmotaVersion: Version: ${version.major}.${version.minor}.${version.revision}`);
            return version;
        } catch (error) {
            this.app.log(error);
            return null;
        }
    }

    saveTasmotaVersion(version: any) {
        try {
            fs.writeFileSync(latestTasmotaReleaseFilename, `v${version.major}.${version.minor}.${version.revision}`, {encoding: 'utf8'});
        } catch (error) {
            this.app.log('Error writing tasmota version file: ' + error);
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
                    this.app.log(`Latest Tasmota release detected ${newVersion.major}.${newVersion.minor}.${newVersion.revision} (no saved version found)`);
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

    makeHttpsRequest(options: {}, timeout: number): Promise<{ statusCode: number, headers: any, body: any }> {
        return new Promise((resolve, reject) => {
            let request = https.request(options, (res) => {
                let resBody = '';
                res.on('data', (chunk) => {
                    resBody += chunk;
                });
                res.once('end', () => {
                    return resolve({
                        statusCode: res.statusCode ?? 404,
                        headers: res.headers,
                        body: resBody
                    }); // resolve the request
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

}

module.exports = TasmotaVersionChecker;

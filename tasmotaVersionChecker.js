import fs from "fs";
import https from "https";

const latestTasmotaReleaseFilename = './userdata/tasmota.ver';
export default class TasmotaVersionChecker {
    constructor(app) {
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

    parseVersionString(versionString) {
        const match = versionString.match(/^v(?<major>\d+)\.(?<minor>\d+)\.(?<revision>\d+)$/);
        if (match === null)
            return null;
        return {major: match.groups.major, minor: match.groups.minor, revision: match.groups.revision}
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
                this.app.log(`makeHttpsRequest error: ${error}`);
            });
            if (result.statusCode !== 200)
                this.app.error(`Error while checking tasmota releases, staus: ${result.statusCode}`);
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

    saveTasmotaVersion(version) {
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

}

module.exports = TasmotaVersionChecker;

import { Buffer } from 'buffer';
import * as readline from 'readline';
import * as request from 'request';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

class ClientSession {

    private sessionId: string;
    private debugIds: Map<string, string> = new Map<string, string>();
    private sources: Map<string, Map<string, ISource>> = new Map<string, Map<string, ISource>>();

    // TODO:  add an "affinity value" so we can consistently connect to the same slot
    constructor(private sitename: string, private username: string, private password: string) {
    }

    private log(msg: string) {
        if (loggingEnabled) {
            console.log(msg);
        }
    }

    private base64Encode(s: string): string {
        const buf = Buffer.from(s, 'utf8');
        return buf.toString('base64');
    }

    private base64Decode(s: string): string {
        const buf = Buffer.from(s, 'base64');
        return buf.toString('utf8');
    }

    private getBaseUri(): string {
        return `https://${this.username}@${this.sitename}.scm.azurewebsites.net`;
    }

    private getAuth() {
        return {
            user: this.username,
            pass: this.password,
            sendImmediately: true
        };
    }

    private async placeSshClient(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const opts = {
                uri: `${this.getBaseUri()}/api/zip/site/wwwroot/`,
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                auth: this.getAuth(),
                body: fs.createReadStream(path.join(__dirname, 'resources/ssh-client.zip'))
            };

            request.put(opts, (err, httpResponse, body) => {
                if (err) {
                    this.log(`placeSshClient(): Error placing ssh-client: ${err}`);
                    reject(err);
                }
                else {
                    this.log(`placeSshClient(): received ${httpResponse.statusCode}`);
                    resolve(`OK`);
                }
            });
        });
    }

    private async sendCommand(command: string): Promise<IOutput> {
        const encoded = this.base64Encode(command);
        this.log(`sendCommand(): command is: [${command}]`)
        this.log(`sendCommand(): encoded command is [${encoded}]`)
        this.log(`sendCommand(): decoded command is [${this.base64Decode(encoded)}]`);
        return new Promise<{ Output: string }>((resolve, reject) => {
            const opts = {
                uri: `${this.getBaseUri()}/api/command`,
                auth: this.getAuth(),
                json: true,
                body: {
                    command: `/usr/bin/node ./ssh-client.js --command ${encoded}`,
                    dir: 'site/wwwroot'
                }
            };

            request.post(opts, (err, httpResponse, body) => {
                this.log('sendCommand(): response is ' + httpResponse.statusCode);
                if (err) {
                    this.log(`sendCommand(): received error: ${err}`);
                    reject(err);
                }
                else if (httpResponse.statusCode === 200) {
                    this.log(util.format('sendCommand():  body is [%j]', body));
                    resolve(body);
                }
                else {
                    reject(`${httpResponse.statusCode} - ${httpResponse.statusMessage}`);
                }
            });

        });
    }

    public getResponseFromCommand(output: IOutput): SshClientResponse {
        const response: SshClientResponse = JSON.parse(output.Output);
        return response;
    }

    public async connect(): Promise<string> {
        return this.placeSshClient()
            .then(() => {
                // TODO:  figure out user name
                return this.sendCommand('/usr/bin/curl -s -X POST http://localhost:32923/debugger/session -d username=userXXX');
            }).then((val: IOutput) => {
                const response = this.getResponseFromCommand(val);
                try {
                    const stdout = JSON.parse(response.stdout);
                    this.log(util.format('stdout is [%j]', stdout));
                    this.sessionId = stdout.data ? stdout.data.debuggingSessionId : undefined;
                    this.log(`connect():  sessionId is ${this.sessionId}`);
                }
                catch (err) {
                    this.log(`connect() - error parsing json response`);
                }

                return this.sessionId;
            });
    }

    public async listProcesses(): Promise<IProcess[]> {
        return this.sendCommand('/usr/bin/curl -s -X GET http://localhost:32923/os/processes?applicationType=Node.js')
            .then((val: IOutput) => {
                const response = this.getResponseFromCommand(val);
                const stdout = JSON.parse(response.stdout);
                return stdout.data as IProcess[];
            });
    }

    public async attach(pid: string): Promise<string> {
        return this.sendCommand(`/usr/bin/curl -s -X POST http://localhost:32923/debugger/session/${this.sessionId}/debugee -d processId=${pid}`)
            .then((val: IOutput) => {
                const response = this.getResponseFromCommand(val);
                const stdout = JSON.parse(response.stdout);
                this.debugIds.set(pid, stdout.data.debugeeId);
                return stdout.data.debugeeId;
            });
    }

    public async listSources(pid: string): Promise<ISource[]> {
        const debugId = this.debugIds.get(pid);

        return this.sendCommand(`/usr/bin/curl -s -X GET http://localhost:32923/debugger/session/${this.sessionId}/debugee/${debugId}/sources?includeInternal=0&includeNodeMdules=0`)
            .then((val: IOutput) => {
                const response = this.getResponseFromCommand(val);
                const stdout = JSON.parse(response.stdout);                
                return stdout.data as ISource[];
            });
    }


}
import * as child_process from 'child_process';
import * as fs from "fs";
import * as path from "path";
import * as req from "request";
import * as WebSiteModels from '../../node_modules/azure-arm-website/lib/models';
import { CommandRunResult } from './structs/CommandRunResult';
import { IAttachProcessRequest } from './structs/IAttachProcessRequest';
import { IAttachProcessResponse } from './structs/IAttachProcessResponse';
import { ICloseSessionRequest } from './structs/ICloseSessionRequest';
import { ICloseSessionResponse } from './structs/ICloseSessionResponse';
import { IEnumerateProcessResponse } from './structs/IEnumerateProcessResponse';
import { ILoadedScriptsRequest } from './structs/ILoadedScriptsRequest';
import { ILoadedScriptsResponse } from './structs/ILoadedScriptsResponse';
import { ILoadSourceRequest } from './structs/ILoadSourceRequest';
import { ILoadSourceResponse } from './structs/ILoadSourceResponse';
import { IRemoveLogpointRequest } from './structs/IRemoveLogpointRequest';
import { IRemoveLogpointResponse } from './structs/IRemoveLogpointResponse';
import { ISetLogpointRequest } from './structs/ISetLogpointRequest';
import { ISetLogpointResponse } from './structs/ISetLogpointResponse';
import { IStartSessionResponse } from './structs/IStartSessionResponse';

// tslint:disable:align
export interface ILogPointsDebuggerClient {
    call<ResponseType>(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, command: string): Promise<CommandRunResult<ResponseType>>;

    startSession(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User): Promise<CommandRunResult<IStartSessionResponse>>;

    closeSession(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: ICloseSessionRequest): Promise<CommandRunResult<ICloseSessionResponse>>;

    enumerateProcesses(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User): Promise<CommandRunResult<IEnumerateProcessResponse>>;

    attachProcess(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: IAttachProcessRequest): Promise<CommandRunResult<IAttachProcessResponse>>;

    loadedScripts(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: ILoadedScriptsRequest): Promise<CommandRunResult<ILoadedScriptsResponse>>;

    loadSource(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: ILoadSourceRequest): Promise<CommandRunResult<ILoadSourceResponse>>;

    setLogpoint(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: ISetLogpointRequest): Promise<CommandRunResult<ISetLogpointResponse>>;

    removeLogpoint(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: IRemoveLogpointRequest): Promise<CommandRunResult<IRemoveLogpointResponse>>;
}

abstract class LogPointsDebuggerClientBase {
    protected abstract call<ResponseType>(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, command: string): Promise<CommandRunResult<ResponseType>>;

    protected makeCallAndLogException<ResponseType>(siteName: string, affinityValue: string,
        publishCredential: WebSiteModels.User, command: string): Promise<CommandRunResult<ResponseType>> {
        return this.call<ResponseType>(siteName, affinityValue, publishCredential, command)
            .catch<CommandRunResult<ResponseType>>((err) => {
                // tslint:disable-next-line:no-suspicious-comment
                // TODO: re-enable
                // util.getOutputChannel().appendLine(`API call error ${err.toString()}`);
                throw err;
            });
    }
}

export class KuduLogPointsDebuggerClient extends LogPointsDebuggerClientBase implements ILogPointsDebuggerClient {
    private static getBaseUri(siteName: string): string {
        return `https://${siteName}.scm.azurewebsites.net`;
    }

    private static getAuth(publishCredential: WebSiteModels.User): req.AuthOptions {
        return {
            user: publishCredential.publishingUserName,
            pass: publishCredential.publishingPassword,
            sendImmediately: true
        };
    }

    private static base64Encode(s: string): string {
        const buf = Buffer.from(s, 'utf8');
        return buf.toString('base64');
    }

    public async startSession(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User): Promise<CommandRunResult<IStartSessionResponse>> {
        await this.uploadSshClient(siteName, affinityValue, publishCredential);
        return this.makeCallAndLogException<IStartSessionResponse>(siteName, affinityValue, publishCredential, "curl -X POST http://localhost:32923/debugger/session");
    }

    public closeSession(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: ICloseSessionRequest): Promise<CommandRunResult<ICloseSessionResponse>> {
        return this.makeCallAndLogException<IStartSessionResponse>(siteName, affinityValue, publishCredential, `curl -X DELETE http://localhost:32923/debugger/session/${data.sessionId}`);
    }

    public enumerateProcesses(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User): Promise<CommandRunResult<IEnumerateProcessResponse>> {
        return this.makeCallAndLogException<IEnumerateProcessResponse>(siteName, affinityValue, publishCredential, "curl -X GET http://localhost:32923/os/processes?applicationType=Node.js");
    }

    public attachProcess(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: IAttachProcessRequest): Promise<CommandRunResult<IAttachProcessResponse>> {
        return this.makeCallAndLogException<IAttachProcessResponse>(siteName, affinityValue, publishCredential,
            `curl -X POST -H "Content-Type: application/json" -d '{"processId":"${data.processId}","codeType":"javascript"}' http://localhost:32923/debugger/session/${data.sessionId}/debugee`);
    }

    public loadedScripts(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: ILoadedScriptsRequest): Promise<CommandRunResult<ILoadedScriptsResponse>> {
        return this.makeCallAndLogException<ILoadedScriptsResponse>(siteName, affinityValue, publishCredential,
            `curl -X GET -H "Content-Type: application/json" http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/sources`);
    }

    public loadSource(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: ILoadSourceRequest): Promise<CommandRunResult<ILoadSourceResponse>> {
        return this.makeCallAndLogException<ILoadSourceResponse>(siteName, affinityValue, publishCredential,
            `curl -X GET -H "Content-Type: application/json" http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/source/${data.sourceId}`);
    }

    public setLogpoint(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: ISetLogpointRequest): Promise<CommandRunResult<ISetLogpointResponse>> {
        return this.makeCallAndLogException<ISetLogpointResponse>(siteName, affinityValue, publishCredential,
            `curl -X POST -H "Content-Type: application/json" -d '{"sourceId":"${data.sourceId}","zeroBasedColumnNumber":"${data.columNumber}", "zeroBasedLineNumber":"${data.lineNumber}", "expressionToLog":"${data.expression}"}' http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/logpoints`);
    }

    public removeLogpoint(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: IRemoveLogpointRequest): Promise<CommandRunResult<IRemoveLogpointResponse>> {
        return this.makeCallAndLogException<IRemoveLogpointResponse>(siteName, affinityValue, publishCredential,
            `curl -X DELETE -H "Content-Type: application/json" http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/logpoints/${data.logpointId}`);
    }

    public call<ResponseType>(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, command: string)
        : Promise<CommandRunResult<ResponseType>> {

        const encodedCommand = KuduLogPointsDebuggerClient.base64Encode(command);

        const opts = {
            uri: `${KuduLogPointsDebuggerClient.getBaseUri(siteName)}/api/command`,
            auth: KuduLogPointsDebuggerClient.getAuth(publishCredential),
            json: true,
            body: {
                command: `/usr/bin/node ./ssh-client.js --command ${encodedCommand}`,
                dir: 'site/wwwroot'
            }
        };

        const request = req.defaults({});
        request.cookie(`ARRAffinity=${affinityValue}`);

        return new Promise<CommandRunResult<ResponseType>>((resolve, reject) => {
            request.post(opts, (err, httpResponse, body) => {
                this.log(`sendCommand(): response is ${httpResponse.statusCode}`);
                if (err) {
                    this.log(`sendCommand(): received error: ${err}`);
                    reject(err);
                } else if (httpResponse.statusCode === 200) {
                    this.log(`sendCommand():  body is ${body}`);
                    resolve(new CommandRunResult<ResponseType>(body.Error, body.ExitCode, body.Output));
                } else {
                    reject(`${httpResponse.statusCode} - ${httpResponse.statusMessage}`);
                }
            });
        });
    }

    private log(message: string): void {
        // tslint:disable-next-line:no-unused-expression
        message && 1;
        // tslint:disable-next-line:no-suspicious-comment
        // TODO: actually log the messsage to somewhere
    }

    private async uploadSshClient(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User): Promise<void> {
        const request = req.defaults({});
        request.cookie(`ARRAffinity=${affinityValue}`);
        const opts = {
            uri: `${KuduLogPointsDebuggerClient.getBaseUri(siteName)}/api/zip/site/wwwroot/`,
            headers: {
                'Content-Type': 'multipart/form-data'
            },
            auth: KuduLogPointsDebuggerClient.getAuth(publishCredential),
            body: fs.createReadStream(path.join(__dirname, '../../../resources/ssh-client.zip'))
        };

        return new Promise<void>((resolve, reject) => {
            // tslint:disable-next-line:no-single-line-block-comment
            request.put(opts, (err, httpResponse/*, body */) => {
                if (err) {
                    this.log(`placeSshClient(): Error placing ssh-client: ${err}`);
                    reject(err);
                } else {
                    this.log(`placeSshClient(): received ${httpResponse.statusCode}`);
                    resolve();
                }
            });
        });
    }
}

export class MockLogpointsDebuggerClient extends LogPointsDebuggerClientBase implements ILogPointsDebuggerClient {
    public startSession(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User): Promise<CommandRunResult<IStartSessionResponse>> {
        return this.makeCallAndLogException<IStartSessionResponse>(siteName, affinityValue, publishCredential, "curl -X POST http://localhost:32923/debugger/session");
    }

    public closeSession(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: ICloseSessionRequest): Promise<CommandRunResult<ICloseSessionResponse>> {
        return this.makeCallAndLogException<IStartSessionResponse>(siteName, affinityValue, publishCredential, `curl -X DELETE http://localhost:32923/debugger/session/${data.sessionId}`);
    }

    public enumerateProcesses(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User): Promise<CommandRunResult<IEnumerateProcessResponse>> {
        return this.makeCallAndLogException<IEnumerateProcessResponse>(siteName, affinityValue, publishCredential, "curl -X GET http://localhost:32923/os/processes?applicationType=Node.js");
    }

    public attachProcess(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: IAttachProcessRequest): Promise<CommandRunResult<IAttachProcessResponse>> {
        return this.makeCallAndLogException<IAttachProcessResponse>(siteName, affinityValue, publishCredential,
            `curl -X POST -H "Content-Type: application/json" -d '{"processId":"${data.processId}","codeType":"javascript"}' http://localhost:32923/debugger/session/${data.sessionId}/debugee`);
    }

    public loadedScripts(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: ILoadedScriptsRequest): Promise<CommandRunResult<ILoadedScriptsResponse>> {
        return this.makeCallAndLogException<ILoadedScriptsResponse>(siteName, affinityValue, publishCredential,
            `curl -X GET -H "Content-Type: application/json" http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/sources`);
    }

    public loadSource(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: ILoadSourceRequest): Promise<CommandRunResult<ILoadSourceResponse>> {
        return this.makeCallAndLogException<ILoadSourceResponse>(siteName, affinityValue, publishCredential,
            `curl -X GET -H "Content-Type: application/json" http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/source/${data.sourceId}`);
    }

    public setLogpoint(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: ISetLogpointRequest): Promise<CommandRunResult<ISetLogpointResponse>> {
        return this.makeCallAndLogException<ISetLogpointResponse>(siteName, affinityValue, publishCredential,
            `curl -X POST -H "Content-Type: application/json" -d '{"sourceId":"${data.sourceId}","zeroBasedColumnNumber":"${data.columNumber}", "zeroBasedLineNumber":"${data.lineNumber}", "expressionToLog":"${data.expression}"}' http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/logpoints`);
    }

    public removeLogpoint(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: IRemoveLogpointRequest): Promise<CommandRunResult<IRemoveLogpointResponse>> {
        return this.makeCallAndLogException<IRemoveLogpointResponse>(siteName, affinityValue, publishCredential,
            `curl -X DELETE -H "Content-Type: application/json" http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/logpoints/${data.logpointId}`);
    }

    public call<ResponseType>(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, command: string): Promise<CommandRunResult<ResponseType>> {
        // tslint:disable-next-line:no-unused-expression
        siteName && affinityValue && publishCredential;

        return new Promise<CommandRunResult<ResponseType>>((resolve) => {
            // tslint:disable-next-line:no-any
            child_process.exec(command, (error: any, stdout: string, stderr: string) => {
                if (error) {
                    resolve(new CommandRunResult<ResponseType>(error, error.code, stderr));
                    return;
                }

                resolve(new CommandRunResult<ResponseType>(null, 0, stdout));
            });
        });
    }
}

import * as req from "request";

import * as child_process from 'child_process';
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

    protected makeCallAndLogException<ResponseType>(
        siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, command: string): Promise<CommandRunResult<ResponseType>> {
        return this.call<ResponseType>(siteName, affinityValue, publishCredential, command)
            .catch<CommandRunResult<ResponseType>>((err) => {
                throw err;
            });
    }
}

export class KuduLogPointsDebuggerClient extends LogPointsDebuggerClientBase implements ILogPointsDebuggerClient {
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
        return this.makeCallAndLogException<IAttachProcessResponse>(
            siteName, affinityValue, publishCredential,
            `curl -X POST -H "Content-Type: application/json" -d '{"processId":"${data.processId}","codeType":"javascript"}' http://localhost:32923/debugger/session/${data.sessionId}/debugee`);
    }

    public loadedScripts(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: ILoadedScriptsRequest): Promise<CommandRunResult<ILoadedScriptsResponse>> {
        return this.makeCallAndLogException<ILoadedScriptsResponse>(
            siteName, affinityValue, publishCredential,
            `curl -X GET -H "Content-Type: application/json" http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/sources`);
    }

    public loadSource(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: ILoadSourceRequest): Promise<CommandRunResult<ILoadSourceResponse>> {
        return this.makeCallAndLogException<ILoadSourceResponse>(
            siteName, affinityValue, publishCredential,
            `curl -X GET -H "Content-Type: application/json" http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/source/${data.sourceId}`);
    }

    public setLogpoint(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: ISetLogpointRequest): Promise<CommandRunResult<ISetLogpointResponse>> {
        return this.makeCallAndLogException<ISetLogpointResponse>(
            siteName, affinityValue, publishCredential,
            `curl -X POST -H "Content-Type: application/json" -d '{"sourceId":"${data.sourceId}","zeroBasedColumnNumber":"${data.columNumber}", "zeroBasedLineNumber":"${data.lineNumber}", "expressionToLog":"${data.expression}"}' http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/logpoints`);
    }

    public removeLogpoint(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: IRemoveLogpointRequest): Promise<CommandRunResult<IRemoveLogpointResponse>> {
        return this.makeCallAndLogException<IRemoveLogpointResponse>(
            siteName, affinityValue, publishCredential,
            `curl -X DELETE -H "Content-Type: application/json" http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/logpoints/${data.logpointId}`);
    }

    public call<ResponseType>(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, command: string)
        : Promise<CommandRunResult<ResponseType>> {

        const headers = {
            // tslint:disable-next-line:prefer-template
            Authorization: "Basic " +
                new Buffer(publishCredential.publishingUserName + ":" + publishCredential.publishingPassword)
                    .toString("base64")
        };

        const r = req.defaults({
            baseUrl: `https://${siteName}.scm.azurewebsites.net/`,
            headers: headers
        });

        r.cookie(`ARRAffinity=${affinityValue}`);
        // tslint:disable-next-line:no-any
        let cb: (err: any, body: any, response: any) => void;
        const promise = new Promise<CommandRunResult<ResponseType>>((resolve, reject) => {
            cb = (err, body?, response?) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`${response.statusCode}: ${body}`));
                    return;
                }

                resolve(new CommandRunResult<ResponseType>(body.Error, body.ExitCode, body.Output));
            };
        });

        r.post(
            {
                uri: "/api/command",
                json: {
                    command: command,
                    dir: '/'
                }
            },
            (err, response, body) => {
                if (err) {
                    return cb(err, null, null);
                }

                cb(null, body, response);
            });

        return promise;
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
        return this.makeCallAndLogException<IAttachProcessResponse>(
            siteName, affinityValue, publishCredential,
            `curl -X POST -H "Content-Type: application/json" -d '{"processId":"${data.processId}","codeType":"javascript"}' http://localhost:32923/debugger/session/${data.sessionId}/debugee`);
    }

    public loadedScripts(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: ILoadedScriptsRequest): Promise<CommandRunResult<ILoadedScriptsResponse>> {
        return this.makeCallAndLogException<ILoadedScriptsResponse>(
            siteName, affinityValue, publishCredential,
            `curl -X GET -H "Content-Type: application/json" http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/sources`);
    }

    public loadSource(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: ILoadSourceRequest): Promise<CommandRunResult<ILoadSourceResponse>> {
        return this.makeCallAndLogException<ILoadSourceResponse>(
            siteName, affinityValue, publishCredential,
            `curl -X GET -H "Content-Type: application/json" http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/source/${data.sourceId}`);
    }

    public setLogpoint(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: ISetLogpointRequest): Promise<CommandRunResult<ISetLogpointResponse>> {
        return this.makeCallAndLogException<ISetLogpointResponse>(
            siteName, affinityValue, publishCredential,
            `curl -X POST -H "Content-Type: application/json" -d '{"sourceId":"${data.sourceId}","zeroBasedColumnNumber":"${data.columNumber}", "zeroBasedLineNumber":"${data.lineNumber}", "expressionToLog":"${data.expression}"}' http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/logpoints`);
    }

    public removeLogpoint(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: IRemoveLogpointRequest): Promise<CommandRunResult<IRemoveLogpointResponse>> {
        return this.makeCallAndLogException<IRemoveLogpointResponse>(
            siteName, affinityValue, publishCredential,
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

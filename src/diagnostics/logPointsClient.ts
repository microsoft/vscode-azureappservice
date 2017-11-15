import * as req from "request";

import * as child_process from 'child_process';
import * as WebSiteModels from '../../node_modules/azure-arm-website/lib/models';

export interface ILogPointsDebuggerClient {
    call<ResponseType>(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, command: string): Promise<CommandRunResult<ResponseType>>;

    startSession(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User): Promise<CommandRunResult<IStartSessionResponse>>;

    enumerateProcesses(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User): Promise<CommandRunResult<IEnumerateProcessResponse>>;

    attachProcess(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: AttachProcessRequest): Promise<CommandRunResult<IAttachProcessResponse>>;

    loadedScripts(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: DebugSessionMetadata): Promise<CommandRunResult<ILoadedScriptsResponse>>;

    loadSource(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: LoadSourceRequest): Promise<CommandRunResult<ILoadSourceResponse>>;

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
    public startSession(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User)
        : Promise<CommandRunResult<IStartSessionResponse>> {
        // tslint:disable-next-line:no-suspicious-comment
        // TODO: The actual command is TBD
        return this.makeCallAndLogException<IStartSessionResponse>(siteName, affinityValue, publishCredential, "node -v");
    }

    public enumerateProcesses(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User): Promise<CommandRunResult<IEnumerateProcessResponse>> {
        // tslint:disable-next-line:no-suspicious-comment
        // TODO: The actual command is TBD
        return this.makeCallAndLogException<IEnumerateProcessResponse>(siteName, affinityValue, publishCredential, "node -v");
    }

    public attachProcess(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User): Promise<CommandRunResult<IAttachProcessResponse>> {
        // tslint:disable-next-line:no-suspicious-comment
        // TODO: The actual command is TBD
        return this.makeCallAndLogException<IAttachProcessResponse>(siteName, affinityValue, publishCredential, "node -v");
    }

    public loadedScripts(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: DebugSessionMetadata): Promise<CommandRunResult<ILoadedScriptsResponse>> {
        // tslint:disable-next-line:no-unused-expression
        siteName && affinityValue && publishCredential && data;
        throw new Error("Method not implemented.");
    }

    public loadSource(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: LoadSourceRequest): Promise<CommandRunResult<ILoadSourceResponse>> {
        // tslint:disable-next-line:no-unused-expression
        siteName && affinityValue && publishCredential && data;
        throw new Error("Method not implemented.");
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

        r.post({
            uri: "/api/command",
            json: {
                command: command,
                dir: '/'
            }
        }, (err, response, body) => {
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

    public enumerateProcesses(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User): Promise<CommandRunResult<IEnumerateProcessResponse>> {
        return this.makeCallAndLogException<IEnumerateProcessResponse>(siteName, affinityValue, publishCredential, "curl -X GET http://localhost:32923/os/processes?applicationType=Node.js");
    }

    public attachProcess(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: AttachProcessRequest): Promise<CommandRunResult<IAttachProcessResponse>> {
        return this.makeCallAndLogException<IAttachProcessResponse>(siteName, affinityValue, publishCredential,
            `curl -X POST -H "Content-Type: application/json" -d '{"processId":"${data.processId}","codeType":"javascript"}' http://localhost:32923/debugger/session/${data.sessionId}/debugee`);
    }

    public loadedScripts(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: DebugSessionMetadata): Promise<CommandRunResult<ILoadedScriptsResponse>> {
        return this.makeCallAndLogException<ILoadedScriptsResponse>(siteName, affinityValue, publishCredential,
            `curl -X GET -H "Content-Type: application/json" http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/sources`);
    }

    public loadSource(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: LoadSourceRequest): Promise<CommandRunResult<ILoadSourceResponse>> {
        return this.makeCallAndLogException<ILoadSourceResponse>(siteName, affinityValue, publishCredential,
            `curl -X GET -H "Content-Type: application/json" http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/source/${data.sourceId}`);
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

// tslint:disable-next-line:max-classes-per-file
export class CommandRunResult<ResponseType extends { error?: {}, data?: {} }> {
    private _json: ResponseType;
    constructor(public error: {}, public exitCode: number, public output: string) {
    }

    public isSuccessful(): boolean {
        return this.exitCode === 0 && this.json && !this.json.error;
    }

    public get json(): ResponseType {
        if (this._json === undefined) {
            try {
                this._json = JSON.parse(this.output);
            } catch (err) {
                // tslint:disable-next-line:no-suspicious-comment
                // TODO: re-enable.
                // util.getOutputChannel().appendLine(`API call error ${err.toString()}`);
                this._json = null;
            }
        }

        return this._json;
    }
}

// tslint:disable-next-line:max-classes-per-file
export class AttachProcessRequest {
    constructor(public sessionId: string, public processId: string) {
    }
}

// tslint:disable-next-line:max-classes-per-file
export class DebugSessionMetadata {
    constructor(public sessionId: string, public debugId: string) {
    }
}

// tslint:disable:max-classes-per-file
export class LoadSourceRequest {
    constructor(public sessionId: string, public debugId: string, public sourceId: string) {
    }
}

export interface IStartSessionResponse {
    data: {
        debuggingSessionId: string
    };
}

export interface IEnumerateProcessResponse {
    data: {
        pid: string;
        command: string;
        // tslint:disable-next-line:no-banned-terms
        arguments: string[];
    }[];
}

export interface IAttachProcessResponse {
    data: {
        debugeeId: string;
    };
}

export interface ILoadedScriptsResponse {
    data: {
        name: string;
        path: string;
        sourceId: string;
    }[];
}

export interface ILoadSourceResponse {
    data: string;
}

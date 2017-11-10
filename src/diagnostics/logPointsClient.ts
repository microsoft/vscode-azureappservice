import * as req from "request";

import * as WebSiteModels from '../../node_modules/azure-arm-website/lib/models';
import * as child_process from 'child_process';


export interface LogPointsDebuggerClient {
    call<ResponseType>(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, command: string): Promise<CommandRunResult<ResponseType>>;

    startSession(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User): Promise<CommandRunResult<StartSessionResponse>>;

    enumerateProcesses(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User): Promise<CommandRunResult<EnumerateProcessResponse>>;

    attachProcess(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: AttachProcessRequest): Promise<CommandRunResult<AttachProcessResponse>>;

    loadedScripts(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: DebugSessionMetadata): Promise<CommandRunResult<LoadedScriptsResponse>>

    loadSource(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: LoadSourceRequest): Promise<CommandRunResult<LoadSourceResponse>>

}

abstract class LogPointsDebuggerClientBase {
    abstract call<ResponseType>(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, command: string): Promise<CommandRunResult<ResponseType>>;

    protected makeCallAndLogException<ResponseType>(siteName: string, affinityValue: string,
        publishCredential: WebSiteModels.User, command: string): Promise<CommandRunResult<ResponseType>> {
        return this.call<ResponseType>(siteName, affinityValue, publishCredential, command)
            .catch<CommandRunResult<ResponseType>>((err) => {
                // TODO: re-enable
                // util.getOutputChannel().appendLine(`API call error ${err.toString()}`);
                throw err;
            });
    }
}

export class KuduLogPointsDebuggerClient extends LogPointsDebuggerClientBase implements LogPointsDebuggerClient {
    public startSession(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User)
        : Promise<CommandRunResult<StartSessionResponse>> {
        // TODO: The actual command is TBD
        return this.makeCallAndLogException<StartSessionResponse>(siteName, affinityValue, publishCredential, "node -v");
    }

    public enumerateProcesses(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User): Promise<CommandRunResult<EnumerateProcessResponse>> {
        // TODO: The actual command is TBD
        return this.makeCallAndLogException<EnumerateProcessResponse>(siteName, affinityValue, publishCredential, "node -v");
    }

    public attachProcess(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User): Promise<CommandRunResult<AttachProcessResponse>> {
        // TODO: The actual command is TBD
        return this.makeCallAndLogException<AttachProcessResponse>(siteName, affinityValue, publishCredential, "node -v");
    }

    public loadedScripts(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: DebugSessionMetadata): Promise<CommandRunResult<LoadedScriptsResponse>> {
        siteName && affinityValue && publishCredential && data;
        throw new Error("Method not implemented.");
    }

    public loadSource(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: LoadSourceRequest): Promise<CommandRunResult<LoadSourceResponse>> {
        siteName && affinityValue && publishCredential && data;
        throw new Error("Method not implemented.");
    }


    public call<ResponseType>(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, command: string)
        : Promise<CommandRunResult<ResponseType>> {

        let headers = {
            "Authorization": "Basic " +
            new Buffer(publishCredential.publishingUserName + ":" + publishCredential.publishingPassword)
                .toString("base64")
        };

        var r = req.defaults({
            baseUrl: "https://" + siteName + ".scm.azurewebsites.net/",
            headers: headers,
        });

        r.cookie(`ARRAffinity=${affinityValue}`);
        let cb: (err, body?, response?) => void;
        let promise = new Promise<CommandRunResult<ResponseType>>((resolve, reject) => {
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
            }
        });

        r.post({
            uri: "/api/command",
            json: {
                command: command,
                dir: '/'
            }
        }, function execCallback(err, response, body) {
            if (err) {
                return cb(err);
            }

            cb(null, body, response);
        });

        return promise;
    }
}

export class MockLogpointsDebuggerClient extends LogPointsDebuggerClientBase implements LogPointsDebuggerClient {
    public startSession(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User): Promise<CommandRunResult<StartSessionResponse>> {
        return this.makeCallAndLogException<StartSessionResponse>(siteName, affinityValue, publishCredential, "curl -X POST http://localhost:32923/debugger/session");
    }

    public enumerateProcesses(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User): Promise<CommandRunResult<EnumerateProcessResponse>> {
        return this.makeCallAndLogException<EnumerateProcessResponse>(siteName, affinityValue, publishCredential, "curl -X GET http://localhost:32923/os/processes?applicationType=Node.js");
    }

    public attachProcess(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: AttachProcessRequest): Promise<CommandRunResult<AttachProcessResponse>> {
        return this.makeCallAndLogException<AttachProcessResponse>(siteName, affinityValue, publishCredential,
            `curl -X POST -H "Content-Type: application/json" -d '{"processId":"${data.processId}","codeType":"javascript"}' http://localhost:32923/debugger/session/${data.sessionId}/debugee`);
    }

    public loadedScripts(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: DebugSessionMetadata): Promise<CommandRunResult<LoadedScriptsResponse>> {
        return this.makeCallAndLogException<LoadedScriptsResponse>(siteName, affinityValue, publishCredential,
            `curl -X GET -H "Content-Type: application/json" http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/sources`);
    }

    public loadSource(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, data: LoadSourceRequest): Promise<CommandRunResult<LoadSourceResponse>> {
        return this.makeCallAndLogException<LoadSourceResponse>(siteName, affinityValue, publishCredential,
            `curl -X GET -H "Content-Type: application/json" http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/source/${data.sourceId}`);
    }

    public call<ResponseType>(siteName: string, affinityValue: string, publishCredential: WebSiteModels.User, command: string): Promise<CommandRunResult<ResponseType>> {
        siteName && affinityValue && publishCredential;

        return new Promise<CommandRunResult<ResponseType>>((resolve) => {
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

export class CommandRunResult<ResponseType extends { error?: any, data?: any }> {
    private _json: ResponseType;
    constructor(public error: any, public exitCode: number, public output: string) {
        this._json = undefined;
    }

    public isSuccessful() {
        return this.exitCode === 0 && this.json && !this.json.error;
    }

    public get json(): ResponseType {
        if (this._json === undefined) {
            try {
                this._json = JSON.parse(this.output);
            } catch (err) {
                // TODO: re-enable.
                // util.getOutputChannel().appendLine(`API call error ${err.toString()}`);
                this._json == null;
            }
        }

        return this._json;
    };
}



export class AttachProcessRequest {
    constructor(public sessionId: string, public processId: string) {
    }
}

export class DebugSessionMetadata {
    constructor(public sessionId: string, public debugId: string) {
    }
}

export class LoadSourceRequest {
    constructor(public sessionId: string, public debugId: string, public sourceId: string) {
    }
}

export interface StartSessionResponse {
    data: {
        debuggingSessionId: string
    }
}

export interface EnumerateProcessResponse {
    data: {
        pid: string;
        command: string;
        arguments: string[];
    }[]
}

export interface AttachProcessResponse {
    data: {
        debugeeId: string;
    }
}

export interface LoadedScriptsResponse {
    data: {
        name: string;
        path: string;
        sourceId: string;
    }[]
}

export interface LoadSourceResponse {
    data: string
}


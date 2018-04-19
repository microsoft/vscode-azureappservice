/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { User } from 'azure-arm-website/lib/models';
import {
    DebugSession, Event, InitializedEvent, Logger, logger,
    LoggingDebugSession, Source,
    TerminatedEvent, Thread
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';

import { createDefaultClient } from './logPointsClient';
import { CommandRunResult } from './structs/CommandRunResult';
import { ICloseSessionRequest } from './structs/ICloseSessionRequest';
import { IGetLogpointsRequest } from './structs/IGetLogpointsRequest';
import { ILoadedScriptsRequest } from './structs/ILoadedScriptsRequest';
import { ILoadedScriptsResponse } from './structs/ILoadedScriptsResponse';
import { ILoadSourceRequest } from './structs/ILoadSourceRequest';
import { IRemoveLogpointRequest } from './structs/IRemoveLogpointRequest';
import { ISetLogpointRequest } from './structs/ISetLogpointRequest';

interface IAttachRequestArguments extends DebugProtocol.AttachRequestArguments {
    trace?: boolean;
    siteName: string;
    publishCredentialUsername: string;
    publishCredentialPassword: string;
    instanceId?: string;
    sessionId: string;
    debugId: string;
}

const logPointsDebuggerClient = createDefaultClient();

export class LogPointsDebugAdapter extends LoggingDebugSession {
    private _sessionId: string;
    private _debugId: string;
    private _siteName: string;
    private _affinityValue: string;
    private _publishingUsername: string;
    private _publishingPassword: string;

    public constructor() {
        super("jsLogPointsdebugadapter.log");

        // uses zero-based lines and columns
        this.setDebuggerLinesStartAt1(false);
        this.setDebuggerColumnsStartAt1(false);
    }

    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
        logger.setup(Logger.LogLevel.Verbose, false);

        super.initializeRequest(response, args);
        this.sendEvent(new InitializedEvent());
    }

    protected attachRequest(response: DebugProtocol.AttachResponse, args: IAttachRequestArguments): void {
        this._sessionId = args.sessionId;
        this._debugId = args.debugId;
        this._siteName = args.siteName;
        this._affinityValue = args.instanceId;
        this._publishingUsername = args.publishCredentialUsername;
        this._publishingPassword = args.publishCredentialPassword;

        response.body = response.body || {};
        response.body.supportsConfigurationDoneRequest = false;

        this.sendResponse(response);
    }

    protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
        // tslint:disable-next-line:no-unused-expression
        args && 1;
        response.body = {
            breakpoints: []
        };
        this.sendResponse(response);
    }

    protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
        // return the default thread
        response.body = {
            threads: [
                new Thread(1, "thread 1")
            ]
        };
        this.sendResponse(response);

        this.getLoadedScripts();

        this.sendSessionStartedEvent();
    }

    // tslint:disable-next-line:no-any
    protected customRequest(command: string, response: DebugProtocol.Response, args: any): void {
        if (command === 'loadSource') {
            const sourceId: string = args;
            const request: ILoadSourceRequest = { sessionId: this._sessionId, debugId: this._debugId, sourceId };
            logPointsDebuggerClient.loadSource(this._siteName, this._affinityValue, this.getPublishCredential(), request).then(
                (result) => {
                    if (result.isSuccessful()) {
                        response.body = {
                            content: result.json.data
                        };
                    } else {
                        response.body = {
                            error: result.error
                        };
                    }
                    this.sendResponse(response);
                });
        } else if (command === 'setLogpoint') {
            const request: ISetLogpointRequest = {
                sessionId: this._sessionId, debugId: this._debugId, sourceId: args.scriptId,
                lineNumber: args.lineNumber, columNumber: args.columnNumber, expression: args.expression
            };
            logPointsDebuggerClient.setLogpoint(this._siteName, this._affinityValue, this.getPublishCredential(), request)
                .then(result => {
                    if (!result.isSuccessful()) {
                        logger.error(`Cannot set logpoint. ${result.error}`);
                    }
                    response.body = result.json;
                    this.sendResponse(response);
                });

        } else if (command === 'removeLogpoint') {
            const request: IRemoveLogpointRequest = { sessionId: this._sessionId, debugId: this._debugId, logpointId: <string>args };
            logPointsDebuggerClient.removeLogpoint(this._siteName, this._affinityValue, this.getPublishCredential(), request)
                .then(result => {
                    logger.log(`removeLogpoint completed. ${require('util').inspect(result)}`);

                    response.body = result.json;
                    this.sendResponse(response);
                });
        } else if (command === 'getLogpoints') {
            const request: IGetLogpointsRequest = { sessionId: this._sessionId, debugId: this._debugId, sourceId: <string>args };

            logPointsDebuggerClient.getLogpoints(this._siteName, this._affinityValue, this.getPublishCredential(), request)
                .then(result => {
                    if (result.isSuccessful()) {
                        response.body = result.json;
                    } else {
                        response.body = {
                            error: result.error
                        };
                    }
                    this.sendResponse(response);
                });

        } else if (command === 'getDebugAdapterMetadata') {
            response.body = {
                siteName: this._siteName,
                publishCredentialUsername: this._publishingUsername,
                publishCredentialPassword: this._publishingPassword,
                instanceId: this._affinityValue,
                sessionId: this._sessionId,
                debugId: this._debugId
            };

            this.sendResponse(response);
        } else if (command === 'terminate') {
            this.sendResponse(response);
            this.sendEvent(new TerminatedEvent());
        }

    }

    protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments): void {
        // There is args.terminateDebuggee, which can be potentially utilized. Ignore for now.
        // tslint:disable-next-line:no-unused-expression
        args && 1;
        const finish = () => {
            // Since the response is just a acknowledgement, the client will not even look at it, so we call sendResponse() regardlesss of the result.
            this.sendResponse(response);
        };
        const request: ICloseSessionRequest = { sessionId: this._sessionId };
        logPointsDebuggerClient.closeSession(this._siteName, this._affinityValue, this.getPublishCredential(), request)
            .then(finish, finish);
    }

    private async getLoadedScripts(): Promise<void> {
        const request: ILoadedScriptsRequest = { sessionId: this._sessionId, debugId: this._debugId };
        const response: CommandRunResult<ILoadedScriptsResponse>
            = await logPointsDebuggerClient.loadedScripts(this._siteName, this._affinityValue, this.getPublishCredential(), request);

        if (response.isSuccessful()) {
            response.json.data.forEach((sourceData) => {
                const source = new Source(sourceData.name, sourceData.path);
                try {
                    source.sourceReference = parseInt(sourceData.sourceId, 10);
                } catch (error) {
                    // if parseInt is not sucessful, then do not set the 'sourceReference' field.
                }

                this.sendEvent(new Event('loadedSource', source));
            });
        }

    }

    private sendSessionStartedEvent(): void {
        this.sendEvent(new Event('sessionStarted'));
    }

    private getPublishCredential(): User {
        return {
            location: undefined,
            publishingUserName: this._publishingUsername,
            publishingPassword: this._publishingPassword
        };
    }
}

DebugSession.run(LogPointsDebugAdapter);

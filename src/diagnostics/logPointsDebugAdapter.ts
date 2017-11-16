import {
    DebugSession, Event, InitializedEvent, Logger, logger,
    LoggingDebugSession, Source,
    Thread
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';

import { CloseSessionRequest, CommandRunResult, DebugSessionMetadata, ILoadedScriptsResponse, LoadSourceRequest, MockLogpointsDebuggerClient, RemoveLogpointRequest, SetLogpointRequest } from './logPointsClient';

interface IAttachRequestArguments extends DebugProtocol.AttachRequestArguments {
    trace?: boolean;
    siteName?: string;
    publishCredentialName?: string;
    publishCredentialPassword?: string;
    instanceId?: string;
    sessionId: string;
    debugId: string;
}

const logPointsDebuggerClient = new MockLogpointsDebuggerClient();

// tslint:disable-next-line:export-name
export class NodeDebugSession extends LoggingDebugSession {
    private _sessionId: string;
    private _debugId: string;

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
    }

    // tslint:disable-next-line:no-any
    protected customRequest(command: string, response: DebugProtocol.Response, args: any): void {
        if (command === 'loadSource') {
            const sourceId: string = args;

            logPointsDebuggerClient.loadSource(null, null, null, new LoadSourceRequest(this._sessionId, this._debugId, sourceId)).then(
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
            logPointsDebuggerClient.setLogpoint(null, null, null,
                                                new SetLogpointRequest(this._sessionId, this._debugId, args.scriptId, args.lineNumber, args.columnNumber, args.expression))
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

        } else if (command === 'removeLogpoint') {
            logPointsDebuggerClient.removeLogpoint(null, null, null, new RemoveLogpointRequest(this._sessionId, this._debugId, <string>args))
                .then(result => {
                    logger.log(`removeLogpoint received. ${require('util').inspect(result)}`);
                });
        }
    }

    protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments): void {
        // There is args.terminateDebuggee, which can be potentially utilized. Ignore for now.
        // tslint:disable-next-line:no-unused-expression
        args && 1;

        logPointsDebuggerClient.closeSession(null, null, null, new CloseSessionRequest(this._sessionId))
            .then(() => {
                // Since the response is just a acknowledgement, the client will not even look at it, so we call sendResponse() regardlesss of the result.
                this.sendResponse(response);
            });
    }

    private async getLoadedScripts(): Promise<void> {
        const response: CommandRunResult<ILoadedScriptsResponse> = await logPointsDebuggerClient.loadedScripts(null, null, null, new DebugSessionMetadata(this._sessionId, this._debugId));

        if (response.isSuccessful()) {
            response.json.data.forEach((sourceData) => {
                const source = new Source(sourceData.name, sourceData.path);
                try {
                    source.sourceReference = parseInt(sourceData.sourceId, 10);
                } catch {
                    // if parseInt is not sucessful, then do not set the 'sourceReference' field.
                }

                this.sendEvent(new Event('loadedSource', source));
            });
        }

    }
}

DebugSession.run(NodeDebugSession);

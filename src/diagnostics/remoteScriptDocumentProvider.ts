import * as vscode from 'vscode';
import { Source } from 'vscode-debugadapter';

type KeyValuePair = {
    [key: string]: string;
    path: string;
    internalScriptId: string;
    vscodeDebugSessionId: string;
};


export module RemoteScriptSchema {
    export const schema = "remote-script";

    export function extractQueryParams(uri: vscode.Uri): KeyValuePair {
        let paramPairs: string[] = uri.query.split("&");
        return paramPairs.reduce((collect: KeyValuePair, paramPair: string) => {
            let parts = paramPair.split('=');
            collect[parts[0]] = parts[1];
            return collect;
        }, <KeyValuePair>{});
    }

    export function create(debugSession: vscode.DebugSession, script: Source): vscode.Uri {
        let scriptPath = script.path;
        if (script.name == script.path) {
            scriptPath = '/native/' + script.name;
        }
        return vscode.Uri.parse(`${RemoteScriptSchema.schema}://${scriptPath}?vscodeDebugSessionId=${debugSession.id}&path=${scriptPath}&internalScriptId=${script.sourceReference}`);
    }
}

export class RemoteScriptDocumentProvider implements vscode.TextDocumentContentProvider {

    public constructor() {
        this.initialize();
    }

    private _debugSessionMapping: { [sessionId: string]: vscode.DebugSession } = {};


    // tslint:disable-next-line:member-ordering
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    // tslint:disable-next-line:member-ordering

    private initialize() {
        // Remember the launched debug sessions, so we can find them later when needed.
        vscode.debug.onDidStartDebugSession((debugSession) => {
            this._debugSessionMapping[debugSession.id] = debugSession;
        });

        vscode.debug.onDidTerminateDebugSession((debugSession) => {
            delete this._debugSessionMapping[debugSession.id];
        });
    }
    public readonly onDidChange: vscode.Event<vscode.Uri> = this._onDidChange.event;

    public provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
        token && 1;
        let params = RemoteScriptSchema.extractQueryParams(uri);

        let debugSession = this._debugSessionMapping[params.vscodeDebugSessionId];

        if (!debugSession) {
            let error = `Cannot find debug session ${params.vscodeDebugSessionId}`;
            vscode.window.showErrorMessage(error);
            return Promise.reject(error);
        }

        return debugSession.customRequest("loadSource", params.internalScriptId).then((result) => {
            return result.content;
        });
    }
}


/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Source } from 'vscode-debugadapter/lib/main';

type KeyValuePair = {
    [key: string]: string;
    path: string;
    internalScriptId: string;
    vscodeDebugSessionId: string;
};

export module RemoteScriptSchema {
    export const schema = "remote-script";

    export function extractQueryParams(uri: vscode.Uri): KeyValuePair {
        const paramPairs: string[] = uri.query.split("&");
        return paramPairs.reduce((collect: KeyValuePair, paramPair: string) => {
            const parts = paramPair.split('=');
            collect[parts[0]] = parts[1];
            return collect;
        }, <KeyValuePair>{});
    }

    export function create(debugSession: vscode.DebugSession, script: Source): vscode.Uri {
        let scriptPath = script.path;
        if (script.name === script.path) {
            scriptPath = `/native/${script.name}`;
        }
        return vscode.Uri.parse(`${RemoteScriptSchema.schema}://${scriptPath}?vscodeDebugSessionId=${debugSession.id}&path=${script.path}&internalScriptId=${script.sourceReference}`);
    }
}

export class RemoteScriptDocumentProvider implements vscode.TextDocumentContentProvider {

    private _debugSessionMapping: { [sessionId: string]: vscode.DebugSession } = {};

    // tslint:disable-next-line:member-ordering
    private _onDidChange: vscode.EventEmitter<vscode.Uri> = new vscode.EventEmitter<vscode.Uri>();
    // tslint:disable-next-line:member-ordering
    public readonly onDidChange: vscode.Event<vscode.Uri> = this._onDidChange.event;

    public constructor() {
        this.initialize();
    }

    public provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
        // tslint:disable-next-line:no-unused-expression
        token && 1;
        const params = RemoteScriptSchema.extractQueryParams(uri);

        const debugSession = this._debugSessionMapping[params.vscodeDebugSessionId];

        if (!debugSession) {
            const error = `Cannot find debug session ${params.vscodeDebugSessionId}`;
            vscode.window.showErrorMessage(error);
            return Promise.reject(error);
        }

        return debugSession.customRequest("loadSource", params.internalScriptId).then((result) => {
            return result.content;
        });
    }

    private initialize(): void {
        // Remember the launched debug sessions, so we can find them later when needed.
        vscode.debug.onDidStartDebugSession((debugSession) => {
            this._debugSessionMapping[debugSession.id] = debugSession;
        });

        vscode.debug.onDidTerminateDebugSession((debugSession) => {
            delete this._debugSessionMapping[debugSession.id];
        });
    }
}

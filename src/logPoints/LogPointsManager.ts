/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as util from 'util';
import * as vscode from 'vscode';
import { DebugSessionCustomEvent } from 'vscode';
import { RemoteScriptSchema } from './remoteScriptDocumentProvider';
import { IDebugSessionMetaData } from './structs/IDebugSessionMetaData';
import { IGetLogpointsResponse } from './structs/IGetLogpointsResponse';
import { IRemoveLogpointResponse } from './structs/IRemoveLogpointResponse';
import { ISetLogpointResponse } from './structs/ISetLogpointResponse';
import { ILogpoint } from './structs/Logpoint';
import { LogpointsCollection } from './structs/LogpointsCollection';
import { SiteClient } from 'vscode-azureappservice';

class DebugSessionManager {
    private _metadata: IDebugSessionMetaData;
    private _logpointsCollectionMapping: { [documentUri: string]: LogpointsCollection };

    constructor(private _debugSession: vscode.DebugSession) {
        this._logpointsCollectionMapping = {};
    }

    public registerLogpoint(documentUri: vscode.Uri, logpoint: ILogpoint): void {
        const logpointsCollection = this.getLogpointCollectionForDocument(documentUri);
        logpointsCollection.registerLogpoint(logpoint);
        logpointsCollection.updateTextEditorDecroration();
    }

    public unregisterLogpoint(documentUri: vscode.Uri, logpoint: ILogpoint): void {
        const logpointsCollection = this.getLogpointCollectionForDocument(documentUri);
        logpointsCollection.unregisterLogpoint(logpoint);
        logpointsCollection.updateTextEditorDecroration();
    }

    public getLogpointAtLocation(documentUri: vscode.Uri, lineNumber: number): ILogpoint | undefined {
        const uriString = documentUri.toString();
        if (!this._logpointsCollectionMapping[uriString]) {
            return undefined;
        }

        const logpointsCollection = this._logpointsCollectionMapping[uriString];
        return logpointsCollection.getLogpointForLine(lineNumber);
    }

    /**
     * Re-display the gutter glyphs for the document of documentUri.
     * @param documentUri the Uri of the document.
     */
    public async recoverLogpoints(documentUri: vscode.Uri): Promise<void> {
        const uriString = documentUri.toString();
        let logpointsCollection = this._logpointsCollectionMapping[uriString];

        // If we have not seen any logpoints for this collection,
        // try to contact server and see if it knows about any existing logpoints.
        if (!logpointsCollection) {
            logpointsCollection = new LogpointsCollection(documentUri);
            this._logpointsCollectionMapping[uriString] = logpointsCollection;

            const params = RemoteScriptSchema.extractQueryParams(documentUri);

            const result: IGetLogpointsResponse = await this._debugSession.customRequest("getLogpoints", params.internalScriptId);
            result.data.forEach(logpoint => {
                logpointsCollection.registerLogpoint({
                    id: logpoint.logpointId,
                    line: logpoint.actualLocation.zeroBasedLineNumber,
                    column: logpoint.actualLocation.zeroBasedColumnNumber,
                    expression: logpoint.expressionToLog
                });
            });
        }
        logpointsCollection.updateTextEditorDecroration();
    }

    public removeLogpointGlyphsFromDocument(documentUri: vscode.Uri): void {
        const logpointsCollection = this.getLogpointCollectionForDocument(documentUri);
        logpointsCollection.clearRegistry();
        logpointsCollection.updateTextEditorDecroration();
    }

    public async addLogpoint(scriptId: string, lineNumber: number, columnNumber: number): Promise<ILogpoint> {
        const expression = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            placeHolder: "Eg: myVar == true ? 'yes' : otherVar",
            prompt: "Expression to be evaluated at the logpoint"
        });

        if (expression === undefined) {
            vscode.window.showErrorMessage("An expression must be provided.");
            throw new Error(`[Set Logpoint] Expression is not provided.`);
        }

        const result: ISetLogpointResponse = await this._debugSession.customRequest("setLogpoint", { scriptId, lineNumber, columnNumber, expression });
        if (result.error !== undefined && result.error !== null) {
            const errorMessage = result.error.message === '' ?
                'Cannot set logpoint. Please refer to https://aka.ms/logpoints#setting-logpoints for more details.' :
                `Cannot set logpoint, the error is "${result.error.message}". Please refer to https://aka.ms/logpoints#setting-logpoints for more details.`;

            // Send telemetry with error by throwing it.
            throw new Error(errorMessage);
        }
        const logpoint = result.data.logpoint;
        return {
            id: logpoint.logpointId, line: logpoint.actualLocation.zeroBasedLineNumber, column:
                logpoint.actualLocation.zeroBasedColumnNumber, expression: logpoint.expressionToLog
        };
    }

    public async removeLogpoint(logpoint: ILogpoint): Promise<void> {
        const result: IRemoveLogpointResponse = await this._debugSession.customRequest("removeLogpoint", logpoint.id);
        if (result.error !== undefined && result.error !== null) {
            const errorMessage = result.error.message === '' ?
                'Cannot remove logpoint. Please refer to https://aka.ms/logpoints for more details.' :
                `Cannot remove logpoint, the error is "${result.error.message}". Please refer to https://aka.ms/logpoints for more details.`;
            throw new Error(errorMessage);
        }
    }

    public async retrieveMetadata(): Promise<IDebugSessionMetaData> {
        if (!this._metadata) {
            const response: IDebugSessionMetaData = await this._debugSession.customRequest("getDebugAdapterMetadata");
            this._metadata = response;
        }

        return this._metadata;
    }

    public async kill(): Promise<void> {
        this._debugSession.customRequest('terminate');
        return;
    }

    private getLogpointCollectionForDocument(documentUri: vscode.Uri): LogpointsCollection {
        const uriString = documentUri.toString();
        let logpointsCollection = this._logpointsCollectionMapping[uriString];
        if (!logpointsCollection) {
            logpointsCollection = new LogpointsCollection(documentUri);
            this._logpointsCollectionMapping[uriString] = logpointsCollection;
        }

        return logpointsCollection;
    }
}

export class LogPointsManager extends vscode.Disposable {
    private _debugSessionManagerMapping: { [key: string]: DebugSessionManager };
    private _siteStreamingLogOutputChannelMapping: { [siteName: string]: vscode.OutputChannel };

    constructor(private _outputChannel: vscode.OutputChannel) {
        super(() => {
            this.cleanup();
        });

        this._debugSessionManagerMapping = {};
        this._siteStreamingLogOutputChannelMapping = {};
        this.initialize();
    }

    public initialize(): void {

        // Remember the launched debug sessions, so we can find them later when needed.
        vscode.debug.onDidStartDebugSession((debugSession) => {
            const debugSessionManager = new DebugSessionManager(debugSession);
            this._debugSessionManagerMapping[debugSession.id] = debugSessionManager;
        });

        vscode.debug.onDidTerminateDebugSession((debugSession) => {
            this.onDebugSessionClose(debugSession);
            delete this._debugSessionManagerMapping[debugSession.id];
            const siteName = debugSession.name;
            if (this._siteStreamingLogOutputChannelMapping[siteName]) {
                delete this._siteStreamingLogOutputChannelMapping[siteName];
            }
        });

        vscode.window.onDidChangeActiveTextEditor((event: vscode.TextEditor) => {
            this.onActiveEditorChange(event);
        });

        vscode.debug.onDidReceiveDebugSessionCustomEvent((event: DebugSessionCustomEvent) => {
            this.onDebugSessionCustomEvent(event);
        });
    }

    public async toggleLogpoint(uri: vscode.Uri): Promise<boolean> {
        if (uri.scheme !== RemoteScriptSchema.schema) {
            vscode.window.showWarningMessage(
                util.format(
                    "Cannot set a tracepoint to this document %s. Expected schema: \"%s\", actual: \"%s\"",
                    uri.fsPath, RemoteScriptSchema.schema, uri.scheme));
            return false;
        }

        if (!vscode.window.activeTextEditor) {
            vscode.window.showInformationMessage("Open a file first to toggle bookmarks");
            return false;
        }

        if (vscode.window.activeTextEditor.document.uri.toString() !== uri.toString()) {
            throw new Error("Invalid operation: cannot operate on an inactive text editor.");
        }

        const line = vscode.window.activeTextEditor.selection.active.line;
        const column = 0;
        const params = RemoteScriptSchema.extractQueryParams(uri);

        const debugSessionManager = this._debugSessionManagerMapping[params.vscodeDebugSessionId];

        if (!debugSessionManager) {
            vscode.window.showErrorMessage(`The debug session associated with this file has expired. Please close this file and open it again from LOADED SCRIPTS explorer of an active logpoints session. More details can be found here http://aka.ms/logpoints#setting-up-logpoints`);
            return false;
        }

        const logpoint = debugSessionManager.getLogpointAtLocation(uri, line);
        if (logpoint) {
            await debugSessionManager.removeLogpoint(logpoint);
            debugSessionManager.unregisterLogpoint(uri, logpoint);
            this._outputChannel.appendLine(`Removed logpoint at line ${logpoint.line} in ${params.path}`);
        } else {
            const newLogpoint = await debugSessionManager.addLogpoint(params.internalScriptId, line, column);
            debugSessionManager.registerLogpoint(uri, newLogpoint);
            this._outputChannel.appendLine(`Added logpoint at line ${newLogpoint.line} in ${params.path}`);
        }

        return true;
    }

    public async onAppServiceSiteClosed(client: SiteClient): Promise<void> {
        const debugSessionManager: DebugSessionManager | undefined = await this.findDebugSessionManagerBySite(client);
        if (!debugSessionManager) {
            // If there is no debugSession associated with the site, then do nothing.
            return;
        }
        await debugSessionManager.kill();
        this._outputChannel.show();
        this._outputChannel.appendLine("The logpoints session has terminated because the App Service is stopped or restarted.");
    }

    public onStreamingLogOutputChannelCreated(client: SiteClient, outputChannel: vscode.OutputChannel): void {
        this._siteStreamingLogOutputChannelMapping[client.fullName] = outputChannel;
    }

    private onActiveEditorChange(activeEditor: vscode.TextEditor): void {
        if (!activeEditor) {
            return;
        }
        const documentUri = activeEditor.document.uri;

        if (documentUri.scheme !== RemoteScriptSchema.schema) {
            return;
        }

        const params = RemoteScriptSchema.extractQueryParams(documentUri);
        const debugSessionManager = this._debugSessionManagerMapping[params.vscodeDebugSessionId];

        if (!debugSessionManager) {
            // If debugSessionManager does not exist, it might be closed. This can happen when user
            // switch to a document that was opened during the debug session before.
            return;
        }

        debugSessionManager.recoverLogpoints(documentUri);
    }

    private onDebugSessionClose(debugSession: vscode.DebugSession): void {

        const debugSessionManager = this._debugSessionManagerMapping[debugSession.id];

        if (!debugSessionManager) {
            // If debugSessionManager does not exist, it might have been handled already.
            return;
        }

        if (!vscode.window.activeTextEditor) {
            return;
        }
        const documentUri = vscode.window.activeTextEditor.document.uri;

        debugSessionManager.removeLogpointGlyphsFromDocument(documentUri);
    }

    private onDebugSessionCustomEvent(e: DebugSessionCustomEvent): void {
        if (e.event === 'sessionStarted') {
            const siteName = e.session.name;

            const streamingLogOutputChannel = this._siteStreamingLogOutputChannelMapping[siteName];

            if (streamingLogOutputChannel) {
                streamingLogOutputChannel.show();
            } else {
                this._outputChannel.show();
                this._outputChannel.appendLine('Cannot find streaming log output channel.');
            }
        }
    }

    private async findDebugSessionManagerBySite(client: SiteClient): Promise<DebugSessionManager | undefined> {
        let matchedDebugSessionManager: DebugSessionManager | undefined;

        const debugSessionManagers = Object.keys(this._debugSessionManagerMapping).map(
            (key) => { return this._debugSessionManagerMapping[key]; });

        for (const debugSessionManager of debugSessionManagers) {
            const debugSessionMetadata = await debugSessionManager.retrieveMetadata();
            if (client.fullName === debugSessionMetadata.siteName) {
                matchedDebugSessionManager = debugSessionManager;
                break;
            }
        }

        return matchedDebugSessionManager;
    }

    // tslint:disable-next-line:no-empty
    private cleanup(): void {
    }
}

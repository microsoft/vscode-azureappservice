import * as util from 'util';
import * as vscode from 'vscode';
import { RemoteScriptSchema } from './remoteScriptDocumentProvider';
import { ISetLogpointResponse } from './structs/ISetLogpointResponse';
import { ILogpoint } from './structs/Logpoint';
import { LogpointsCollection } from './structs/LogpointsCollection';

class DebugSessionManager {
    private _logpointsCollectionMapping: { [documentUri: string]: LogpointsCollection };

    constructor(private _debugSession: vscode.DebugSession) {
        this._logpointsCollectionMapping = {};
    }

    public toggleLogpoint(): ILogpoint {
        return null;
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

    public getLogpointAtLocation(documentUri: vscode.Uri, lineNumber: number): ILogpoint {
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
    public recoverLogpoints(documentUri: vscode.Uri): void {
        const logpointsCollection = this.getLogpointCollectionForDocument(documentUri);
        logpointsCollection.updateTextEditorDecroration();
    }

    /**
     * Contact server and see what logpoints exist already.
     */
    public async reloadLogpoints(): Promise<void> {
        // Since the API is absent, this method is TBD.
        //await this._debugSession.customRequest("loadLogpoints");
    }

    public async addLogpoint(scriptId: string, lineNumber: number, columnNumber: number): Promise<ILogpoint> {
        const expression = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            placeHolder: "Eg: myVar == true ? 'yes' : otherVar",
            prompt: "Expression to be evaluated at the logpoint"
        });

        if (expression === undefined) {
            vscode.window.showErrorMessage("An expression must be provided.");
            return null;
        }

        const result: ISetLogpointResponse = await this._debugSession.customRequest("setLogpoint", { scriptId, lineNumber, columnNumber, expression });
        const logpoint = result.data.logpoint;
        return {
            id: logpoint.logpointId, line: logpoint.actualLocation.zeroBasedLineNumber, column:
                logpoint.actualLocation.zeroBasedColumnNumber, expression: logpoint.expressionToLog
        };
    }

    public async removeLogpoint(logpoint: ILogpoint): Promise<void> {
        await this._debugSession.customRequest("removeLogpoint", logpoint.id);
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

    constructor(private _outputChannel: vscode.OutputChannel) {
        super(() => {
            this.cleanup();
        });

        this._debugSessionManagerMapping = {};
        this.initialize();
    }

    public initialize(): void {

        // Remember the launched debug sessions, so we can find them later when needed.
        vscode.debug.onDidStartDebugSession((debugSession) => {
            const debugSessionManager = new DebugSessionManager(debugSession);
            this._debugSessionManagerMapping[debugSession.id] = debugSessionManager;
            debugSessionManager.reloadLogpoints();
        });

        vscode.debug.onDidTerminateDebugSession((debugSession) => {
            delete this._debugSessionManagerMapping[debugSession.id];
        });

        vscode.window.onDidChangeActiveTextEditor((event: vscode.TextEditor) => {
            this.onActiveEditorChange(event);
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
            vscode.window.showErrorMessage(`Cannot find debug session with id ${params.vscodeDebugSessionId}`);
            return false;
        }

        let logpoint = debugSessionManager.getLogpointAtLocation(uri, line);
        if (logpoint) {
            debugSessionManager.removeLogpoint(logpoint);
            debugSessionManager.unregisterLogpoint(uri, logpoint);
            this._outputChannel.appendLine(`Removed logpoint at line ${logpoint.line} in ${params.path}`);
        } else {
            logpoint = await debugSessionManager.addLogpoint(params.internalScriptId, line, column);
            debugSessionManager.registerLogpoint(uri, logpoint);
            this._outputChannel.appendLine(`Added logpoint at line ${logpoint.line} in ${params.path}`);
        }

        return true;
    }

    private onActiveEditorChange(activeEditor: vscode.TextEditor): void {
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

    // tslint:disable-next-line:no-empty
    private cleanup(): void {
    }
}

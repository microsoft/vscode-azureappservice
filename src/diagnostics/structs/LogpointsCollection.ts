import * as util from 'util';
import * as vscode from 'vscode';
import { ILogpoint } from './Logpoint';
// tslint:disable:align

export class LogpointsCollection {
    public static TextEditorDecorationType: vscode.TextEditorDecorationType;

    private _logpointRegistry: { [line: number]: ILogpoint };

    public constructor(private _documentUri: vscode.Uri) {
        this._logpointRegistry = {};
    }

    public get documentUri(): vscode.Uri {
        return this._documentUri;
    }

    public getLogpointForLine(line: number): ILogpoint | undefined {
        return this._logpointRegistry[line];
    }

    public registerLogpoint(tracepoint: ILogpoint): void {
        if (this.getLogpointForLine(tracepoint.line)) {
            vscode.window.showInformationMessage(util.format("There is already a tracepoint at line %d, setting a new tracepoint will overwrite that."));
        }
        this._logpointRegistry[tracepoint.line] = tracepoint;
    }

    public unregisterLogpoint(tracepoint: ILogpoint): void {
        if (this._logpointRegistry[tracepoint.line]) {
            delete this._logpointRegistry[tracepoint.line];
        } else {
            throw new Error(
                util.format("Cannot find a tracepoint at line %d to delete in %s. It has not been recorded.", tracepoint.line,
                    this._documentUri.fsPath));
        }
    }

    public getLogpoints(): ILogpoint[] {
        // tslint:disable-next-line:no-any
        return (<any>Object).values(this._logpointRegistry);
    }

    public updateTextEditorDecroration(): void {
        if (!vscode.window.activeTextEditor) {
            return;
        }

        if (this._documentUri.toString() !== vscode.window.activeTextEditor.document.uri.toString()) {
            // Cannot control non-active editor, no-op.
            return;
        }

        if (!LogpointsCollection.TextEditorDecorationType) {
            // If LogpointsCollection.TextEditorDecorationType is not set, it means the extension is not ready yet.
            throw new Error('The extension initiation is expected to finish now.');
        }

        const ranges: vscode.Range[] = [];

        const logpoints = this.getLogpoints();
        // Do this even if the `logpoints` is empty, then we clear all the existing decorations
        (logpoints || []).forEach((logpoint: ILogpoint) => {
            const line = logpoint.line;
            ranges.push(new vscode.Range(line, 0, line, 0));
        });

        vscode.window.activeTextEditor.setDecorations(LogpointsCollection.TextEditorDecorationType, ranges);
    }
}

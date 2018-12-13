/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { IAzureQuickPickItem, TelemetryProperties, UserCancelledError } from 'vscode-azureextensionui';

// Resource ID
export function parseAzureResourceId(resourceId: string): { [key: string]: string } {
    const invalidIdErr = new Error('Invalid web app ID.');
    const result = {};

    if (!resourceId || resourceId.length < 2 || resourceId.charAt(0) !== '/') {
        throw invalidIdErr;
    }

    const parts = resourceId.substring(1).split('/');

    if (parts.length % 2 !== 0) {
        throw invalidIdErr;
    }

    for (let i = 0; i < parts.length; i += 2) {
        const key = parts[i];
        const value = parts[i + 1];

        if (key === '' || value === '') {
            throw invalidIdErr;
        }

        result[key] = value;
    }

    return result;
}

export async function showQuickPickByFileExtension(telemetryProperties: TelemetryProperties, placeHolderString: string, fileExtension: string = '*'): Promise<string> {
    const files: vscode.Uri[] = await vscode.workspace.findFiles(`**/*.${fileExtension}`);
    const quickPickItems: IAzureQuickPickItem<string | undefined>[] = files.map((uri: vscode.Uri) => {
        return {
            label: path.basename(uri.fsPath),
            description: uri.fsPath,
            data: uri.fsPath
        };
    });

    quickPickItems.push({ label: '$(package) Browse...', description: '', data: undefined });

    const quickPickOption = { placeHolder: placeHolderString };
    const pickedItem = await vscode.window.showQuickPick(quickPickItems, quickPickOption);

    if (!pickedItem) {
        telemetryProperties.cancelStep = `show${fileExtension}`;
        throw new UserCancelledError();
    } else if (!pickedItem.data) {
        const browseResult = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            defaultUri: vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : undefined,
            filters: { Artifacts: [fileExtension] }
        });

        if (!browseResult) {
            telemetryProperties.cancelStep = `show${fileExtension}Browse`;
            throw new UserCancelledError();
        }

        return browseResult[0].fsPath;
    } else {
        return pickedItem.data;
    }
}

export interface IQuickPickItemWithData<T> extends vscode.QuickPickItem {
    persistenceId?: string; // A unique key to identify this item items across sessions, used in persisting previous selections
    data?: T;
}

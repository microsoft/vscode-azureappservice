/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { TelemetryProperties, UserCancelledError } from 'vscode-azureextensionui';
import { configurationSettings, extensionPrefix } from './constants';

// Output channel for the extension
const outputChannel = vscode.window.createOutputChannel("Azure App Service");

export function getOutputChannel(): vscode.OutputChannel {
    return outputChannel;
}

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

export async function showWorkspaceFoldersQuickPick(placeHolderString: string, telemetryProperties: TelemetryProperties, subPathSetting: string | undefined): Promise<string> {
    const folderQuickPickItems = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.map((value) => {
        {
            const subpath: string = vscode.workspace.getConfiguration(extensionPrefix, value.uri).get(configurationSettings.deploySubpath);
            const fsPath: string = subPathSetting ? path.join(value.uri.fsPath, subpath) : value.uri.fsPath;

            return {
                label: value.name,
                description: fsPath,
                data: fsPath
            };
        }
    }) : [];

    folderQuickPickItems.unshift({ label: '$(file-directory) Browse...', description: '', data: undefined });

    const folderQuickPickOption = { placeHolder: placeHolderString };
    const pickedItem = await vscode.window.showQuickPick(folderQuickPickItems, folderQuickPickOption);

    if (!pickedItem) {
        telemetryProperties.cancelStep = 'showWorkspaceFolders';
        throw new UserCancelledError();
    }

    if (pickedItem && !pickedItem.data) {
        const browseResult = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : undefined
        });

        if (!browseResult) {
            telemetryProperties.cancelStep = 'showWorkspaceFoldersBrowse';
            throw new UserCancelledError();
        }

        return browseResult[0].fsPath;
    }

    return pickedItem.data;
}

export interface IQuickPickItemWithData<T> extends vscode.QuickPickItem {
    persistenceId?: string; // A unique key to identify this item items across sessions, used in persisting previous selections
    data?: T;
}

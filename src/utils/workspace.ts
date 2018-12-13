/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { extensionPrefix } from 'src/constants';
import { ext } from 'src/extensionVariables';
import * as vscode from 'vscode';
import { IAzureQuickPickItem, IAzureUserInput, TelemetryProperties, UserCancelledError } from 'vscode-azureextensionui';

export async function selectWorkspaceFile(ui: IAzureUserInput, placeHolder: string, getSubPath?: (f: vscode.WorkspaceFolder) => string | undefined): Promise<string> {
    let defaultUri: vscode.Uri | undefined;
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0 && getSubPath) {
        const firstFolder: vscode.WorkspaceFolder = vscode.workspace.workspaceFolders[0];
        const subPath: string | undefined = getSubPath(firstFolder);
        if (subPath) {
            defaultUri = vscode.Uri.file(path.join(firstFolder.uri.fsPath, subPath));
        }
    }

    return await selectWorkspaceItem(
        ui,
        placeHolder,
        {
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            defaultUri: defaultUri,
            openLabel: 'Select'
        },
        getSubPath);
}

export async function selectWorkspaceItem(ui: IAzureUserInput, placeHolder: string, options: vscode.OpenDialogOptions, getSubPath?: (f: vscode.WorkspaceFolder) => string | undefined): Promise<string> {
    let folder: IAzureQuickPickItem<string | undefined> | undefined;
    if (vscode.workspace.workspaceFolders) {
        const folderPicks: IAzureQuickPickItem<string | undefined>[] = vscode.workspace.workspaceFolders.map((f: vscode.WorkspaceFolder) => {
            let subpath: string | undefined;
            if (getSubPath) {
                subpath = getSubPath(f);
            }

            const fsPath: string = subpath ? path.join(f.uri.fsPath, subpath) : f.uri.fsPath;
            return { label: path.basename(fsPath), description: fsPath, data: fsPath };
        });

        folderPicks.push({ label: '$(file-directory) Browse...', description: '', data: undefined });
        folder = await ui.showQuickPick(folderPicks, { placeHolder });
    }

    return folder && folder.data ? folder.data : (await ui.showOpenDialog(options))[0].fsPath;
}

export async function showWorkspaceFoldersQuickPick(placeHolderString: string, telemetryProperties: TelemetryProperties, subPathSetting: string | undefined): Promise<string> {
    const folderQuickPickItems: IAzureQuickPickItem<string | undefined>[] = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.map((value) => {
        {
            let fsPath: string = value.uri.fsPath;
            if (subPathSetting) {
                const subpath: string | undefined = vscode.workspace.getConfiguration(extensionPrefix, value.uri).get(subPathSetting);
                if (subpath) {
                    fsPath = path.join(fsPath, subpath);
                }
            }

            return {
                label: path.basename(fsPath),
                description: fsPath,
                data: fsPath
            };
        }
    }) : [];

    folderQuickPickItems.push({ label: '$(file-directory) Browse...', description: '', data: undefined });

    const folderQuickPickOption = { placeHolder: placeHolderString };
    telemetryProperties.cancelStep = 'showWorkspaceFolders';
    const pickedItem = await ext.ui.showQuickPick(folderQuickPickItems, folderQuickPickOption);
    telemetryProperties.cancelStep = '';

    if (!pickedItem.data) {
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
    } else {
        return pickedItem.data;
    }
}

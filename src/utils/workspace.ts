/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { IAzureQuickPickItem } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { isPathEqual, isSubpath } from '../utils/pathUtils';

export async function selectWorkspaceFile(placeHolder: string, getSubPath?: (f: vscode.WorkspaceFolder) => string | undefined): Promise<string> {
    let defaultUri: vscode.Uri | undefined;
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0 && getSubPath) {
        const firstFolder: vscode.WorkspaceFolder = vscode.workspace.workspaceFolders[0];
        const subPath: string | undefined = getSubPath(firstFolder);
        if (subPath) {
            defaultUri = vscode.Uri.file(path.join(firstFolder.uri.fsPath, subPath));
        }
    }

    return await selectWorkspaceItem(
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

export async function selectWorkspaceItem(placeHolder: string, options: vscode.OpenDialogOptions, getSubPath?: (f: vscode.WorkspaceFolder) => string | undefined, fileExtension?: string): Promise<string> {
    let folder: IAzureQuickPickItem<string | undefined> | undefined;
    let quickPicks: IAzureQuickPickItem<string | undefined>[] = [];
    if (vscode.workspace.workspaceFolders) {
        // if there's a fileExtension, then only populate the quickPick menu with that, otherwise show the current folders in the workspace
        quickPicks = fileExtension ? mapFilesToQuickPickItems(await findFilesByFileExtension(undefined, fileExtension)) :
            vscode.workspace.workspaceFolders.map((f: vscode.WorkspaceFolder) => {
                let subpath: string | undefined;
                if (getSubPath) {
                    subpath = getSubPath(f);
                }

                const fsPath: string = subpath ? path.join(f.uri.fsPath, subpath) : f.uri.fsPath;
                return { label: path.basename(fsPath), description: fsPath, data: fsPath };
            });

        quickPicks.push({ label: '$(file-directory) Browse...', description: '', data: undefined });
        folder = await ext.ui.showQuickPick(quickPicks, { placeHolder });
    }

    return folder && folder.data ? folder.data : (await ext.ui.showOpenDialog(options))[0].fsPath;
}

export function getContainingWorkspace(fsPath: string): vscode.WorkspaceFolder | undefined {
    // tslint:disable-next-line:strict-boolean-expressions
    const openFolders: vscode.WorkspaceFolder[] = vscode.workspace.workspaceFolders || [];
    return openFolders.find((f: vscode.WorkspaceFolder): boolean => {
        return isPathEqual(f.uri.fsPath, fsPath) || isSubpath(f.uri.fsPath, fsPath);
    });
}

export async function findFilesByFileExtension(fsPath: string | undefined, fileExtension: string): Promise<vscode.Uri[]> {
    // if there is a fsPath, then only check the folder for the file extension, otherwise use all currently opened workspaces
    const relativeDirectory: vscode.RelativePattern | string = fsPath ? new vscode.RelativePattern(fsPath, `*.${fileExtension}`) : path.join('**', `*.${fileExtension}`);
    return await vscode.workspace.findFiles(relativeDirectory);
}

export function mapFilesToQuickPickItems(files: vscode.Uri[]): IAzureQuickPickItem<string>[] {
    return files.map((uri: vscode.Uri) => {
        return {
            label: path.basename(uri.fsPath),
            description: uri.fsPath,
            data: uri.fsPath
        };
    });
}

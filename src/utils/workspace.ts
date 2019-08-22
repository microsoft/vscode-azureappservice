/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { IActionContext, IAzureQuickPickItem } from 'vscode-azureextensionui';
import { configurationSettings, extensionPrefix } from '../constants';
import { SiteTreeItem } from '../explorer/SiteTreeItem';
import { ext } from '../extensionVariables';
import { isPathEqual, isSubpath } from '../utils/pathUtils';
import { getWorkspaceSetting } from '../vsCodeConfig/settings';

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

async function selectWorkspaceItem(placeHolder: string, options: vscode.OpenDialogOptions, getSubPath?: (f: vscode.WorkspaceFolder) => string | undefined, fileExtension?: string): Promise<string> {
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

async function selectWorkspaceFolder(placeHolderString: string, context: IActionContext, subPathSetting: string | undefined): Promise<string> {
    context.telemetry.properties.cancelStep = 'selectWorkspaceFolder';
    return await selectWorkspaceItem(
        placeHolderString,
        {
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : undefined
        },
        (f: vscode.WorkspaceFolder): string | undefined => {
            if (subPathSetting) {
                return vscode.workspace.getConfiguration(extensionPrefix, f.uri).get(subPathSetting);
            }
            return;
        });
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

export async function getDeploymentWorkspace(context: IActionContext, target?: vscode.Uri | SiteTreeItem, fileExtension?: string): Promise<string> {
    if (target instanceof vscode.Uri) {
        return target.fsPath;
    } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length === 1) {
        // If there is only one workspace and it has 'deploySubPath' set - return that value without prompting
        const folderPath: string = vscode.workspace.workspaceFolders[0].uri.fsPath;
        if (getWorkspaceSetting<string>(configurationSettings.deploySubpath, folderPath)) {
            return folderPath;
        }
    }

    const workspaceMessage: string = fileExtension ? `Select the ${fileExtension} file to deploy` : 'Select the folder to zip and deploy';
    const filter: { [name: string]: string[] } = {};
    if (fileExtension) {
        filter[fileExtension] = [fileExtension];
    }

    return fileExtension ?
        await selectWorkspaceItem(workspaceMessage, { filters: filter, canSelectFiles: true }, f => getWorkspaceSetting(configurationSettings.deploySubpath, f.uri.fsPath), fileExtension) :
        await selectWorkspaceFolder(workspaceMessage, context, configurationSettings.deploySubpath);
}

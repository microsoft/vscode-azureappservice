/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { DialogResponses } from 'vscode-azureextensionui';
import { configurationSettings, extensionPrefix } from '../../constants';
import { SiteTreeItem } from '../../explorer/SiteTreeItem';
import { ext } from '../../extensionVariables';
import { isPathEqual, isSubpath } from '../../utils/pathUtils';
import * as workspaceUtil from '../../utils/workspace';
import { getWorkspaceSetting, updateGlobalSetting } from '../../vsCodeConfig/settings';

export async function getDeployFsPath(target: vscode.Uri | string | SiteTreeItem | undefined): Promise<string> {
    if (target instanceof vscode.Uri) {
        return await appendDeploySubpathSetting(target.fsPath);
    } else if (typeof target === 'string') {
        return await appendDeploySubpathSetting(target);
    } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length === 1) {
        // If there is only one workspace and it has 'deploySubPath' set - return that value without prompting
        const folderPath: string = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const deploySubpath: string | undefined = getWorkspaceSetting(configurationSettings.deploySubpath, folderPath);
        if (deploySubpath) {
            return path.join(folderPath, deploySubpath);
        }
    }

    const workspaceMessage: string = 'Select the folder to zip and deploy';
    return await workspaceUtil.selectWorkspaceItem(workspaceMessage, {}, f => getWorkspaceSetting(configurationSettings.deploySubpath, f.uri.fsPath));
}

/**
 * Appends the deploySubpath setting if the target path matches the root of a workspace folder
 * If the targetPath is a sub folder instead of the root, leave the targetPath as-is and assume they want that exact folder used
 */
async function appendDeploySubpathSetting(targetPath: string): Promise<string> {
    if (vscode.workspace.workspaceFolders) {
        const deploySubPath: string | undefined = getWorkspaceSetting(configurationSettings.deploySubpath, targetPath);
        if (deploySubPath) {
            if (vscode.workspace.workspaceFolders.some(f => isPathEqual(f.uri.fsPath, targetPath))) {
                return path.join(targetPath, deploySubPath);
            } else {
                const folder: vscode.WorkspaceFolder | undefined = vscode.workspace.workspaceFolders.find(f => isSubpath(f.uri.fsPath, targetPath));
                if (folder) {
                    const fsPathWithSetting: string = path.join(folder.uri.fsPath, deploySubPath);
                    if (!isPathEqual(fsPathWithSetting, targetPath)) {
                        const settingKey: string = 'showDeploySubpathWarning';
                        if (getWorkspaceSetting(settingKey)) {
                            const selectedFolder: string = path.relative(folder.uri.fsPath, targetPath);
                            const message: string = `Deploying "${deploySubPath}" instead of selected folder "${selectedFolder}". Use "${extensionPrefix}.${configurationSettings.deploySubpath}" to change this behavior.`;
                            // don't wait
                            // tslint:disable-next-line:no-floating-promises
                            ext.ui.showWarningMessage(message, { title: 'OK' }, DialogResponses.dontWarnAgain).then(async (result: vscode.MessageItem) => {
                                if (result === DialogResponses.dontWarnAgain) {
                                    await updateGlobalSetting(settingKey, false);
                                }
                            });
                        }
                    }

                    return fsPathWithSetting;
                }
            }
        }
    }

    return targetPath;
}

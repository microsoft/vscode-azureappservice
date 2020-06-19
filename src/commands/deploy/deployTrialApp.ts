/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ProgressLocation, window, workspace, WorkspaceFolder } from 'vscode';
import { localGitDeploy } from 'vscode-azureappservice';
import { IActionContext } from 'vscode-azureextensionui';
import { WebAppTreeItem } from '../../../extension.bundle';
import { SiteTreeItem } from '../../explorer/SiteTreeItem';
import { TrialAppTreeItem } from '../../explorer/trialApp/TrialAppTreeItem';
import { ext } from '../../extensionVariables';
import { localize } from '../../localize';
import { selectWorkspaceFolder } from '../../utils/workspace';
import { showDeployCompletedMessage } from './showDeployCompletedMessage';

export async function deployTrialApp(context: IActionContext, trialAppTreeItem: TrialAppTreeItem): Promise<void> {
    const workspaceFolders: WorkspaceFolder[] | undefined = workspace.workspaceFolders;

    let path: string;
    let workspaceFolder: WorkspaceFolder | undefined;
    if (workspaceFolders?.length === 1) {
        workspaceFolder = workspaceFolders[0];
        path = workspaceFolder.uri.fsPath;
    } else {
        const selectFolderWithRepo: string = localize('selectFolderWithRepo', 'Select a folder containing a repository to deploy');
        path = await selectWorkspaceFolder(selectFolderWithRepo);
        workspaceFolder = workspace.getWorkspaceFolder(vscode.Uri.file(path));
    }

    const commit: boolean = workspaceFolder?.name === trialAppTreeItem.metadata.siteName;

    const title: string = localize('deploying', 'Deploying to "{0}"... Check [output window](command:{1}) for status.', trialAppTreeItem.client.fullName, `${ext.prefix}.showOutputChannel`);
    await window.withProgress({ location: ProgressLocation.Notification, title }, async () => {
        await localGitDeploy(trialAppTreeItem.client, { fsPath: path, branch: 'RELEASE', commit: commit }, context);
        return showDeployCompletedMessage(trialAppTreeItem);
    });
}

export async function getDeployNodeWithTrialApp(context: IActionContext, target?: vscode.Uri | TrialAppTreeItem | SiteTreeItem): Promise<vscode.Uri | SiteTreeItem | TrialAppTreeItem | undefined> {
    if (!target) {
        const trialApp: TrialAppTreeItem | undefined = ext.azureAccountTreeItem.trialAppNode;
        if (trialApp) {
            if (ext.azureAccountTreeItem.isLoggedIn) {
                return await ext.tree.showTreeItemPicker<SiteTreeItem | TrialAppTreeItem>([WebAppTreeItem.contextValue, TrialAppTreeItem.contextValue], context);
            } else {
                return trialApp;
            }
        }
    }
    return target;
}

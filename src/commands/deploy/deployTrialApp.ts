/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ProgressLocation, window, workspace, WorkspaceFolder } from 'vscode';
import { localGitDeploy } from 'vscode-azureappservice';
import { AzExtTreeItem, GenericTreeItem, IActionContext } from 'vscode-azureextensionui';
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
    let commit: boolean = false;

    if (workspaceFolders?.length === 1) {
        path = workspaceFolders[0].uri.fsPath;
        commit = workspaceFolders[0].name === trialAppTreeItem.metadata.siteName;
    } else {
        path = await selectWorkspaceFolder('Select folder containing a repository to deploy');
    }

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
            const children: AzExtTreeItem[] = await ext.azureAccountTreeItem.getCachedChildren(context);
            // check if user is signed out with a trial app
            if (children[0] instanceof GenericTreeItem) {
                return trialApp;
            } else {
                // user is signed in and has trial app
                return await ext.tree.showTreeItemPicker<SiteTreeItem | TrialAppTreeItem>([WebAppTreeItem.contextValue, TrialAppTreeItem.contextValue], context);
            }
        }
    }

    return target;
}

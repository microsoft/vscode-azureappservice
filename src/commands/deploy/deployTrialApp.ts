/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { MessageItem, ProgressLocation, window, workspace, WorkspaceFolder } from 'vscode';
import { localGitDeploy } from 'vscode-azureappservice';
import { AzExtTreeItem, IActionContext } from 'vscode-azureextensionui';
import { WebAppTreeItem } from '../../../extension.bundle';
import { SiteTreeItem } from '../../explorer/SiteTreeItem';
import { TrialAppTreeItem } from '../../explorer/trialApp/TrialAppTreeItem';
import { ext } from '../../extensionVariables';
import { localize } from '../../localize';
import { selectWorkspaceFolder } from '../../utils/workspace';
import { cloneTrialApp } from '../trialApp/cloneTrialApp';
import { showDeployCompletedMessage } from './showDeployCompletedMessage';

export async function deployTrialApp(context: IActionContext, trialAppTreeItem: TrialAppTreeItem): Promise<void> {

    const workspaceFolders: WorkspaceFolder[] | undefined = workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        const message: string = localize('unableToDeployTrialApp', 'Unable to deploy trial app: Clone trial app source and open folder in VS Code to deploy');
        const clone: MessageItem = { title: 'Clone trial app' };
        return await window.showErrorMessage(message, clone).then(async (value: MessageItem) => {
            if (value === clone) {
                await cloneTrialApp(context, trialAppTreeItem);
            }
        });
    }

    let path: string;
    if (workspaceFolders.length === 1 && workspaceFolders[0].name === trialAppTreeItem.metadata.siteName) {
        path = workspaceFolders[0].uri.fsPath;
    } else {
        path = await selectWorkspaceFolder('Select folder containing a repository to deploy');
    }
    const title: string = localize('deploying', 'Deploying to "{0}"... Check [output window](command:{1}) for status.', trialAppTreeItem.client.fullName, `${ext.prefix}.showOutputChannel`);
    await window.withProgress({ location: ProgressLocation.Notification, title }, async () => {
        await localGitDeploy(trialAppTreeItem.client, { fsPath: path, branch: 'RELEASE', commit: true }, context);
        return showDeployCompletedMessage(trialAppTreeItem);
    });
}

export async function getDeployNodeWithTrialApp(context: IActionContext, target?: vscode.Uri | TrialAppTreeItem | SiteTreeItem): Promise<vscode.Uri | SiteTreeItem | TrialAppTreeItem | undefined> {
    if (!target) {
        const trialApp: TrialAppTreeItem | undefined = ext.azureAccountTreeItem.trialAppNode;
        if (trialApp) {
            const children: AzExtTreeItem[] = await ext.azureAccountTreeItem.getCachedChildren(context);
            // check if user is signed out with a trial app
            if (children[2] instanceof TrialAppTreeItem) {
                return trialApp;
            } else {
                // user is signed in and has trial app
                return await ext.tree.showTreeItemPicker<SiteTreeItem | TrialAppTreeItem>([WebAppTreeItem.contextValue, TrialAppTreeItem.contextValue], context);
            }
        }
    }

    return target;
}

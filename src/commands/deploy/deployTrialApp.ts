/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as git from 'simple-git/promise';
import * as vscode from 'vscode';
import { commands, MessageItem, ProgressLocation, window, workspace, WorkspaceFolder } from 'vscode';
import { AzExtTreeItem, callWithTelemetryAndErrorHandling, IActionContext } from 'vscode-azureextensionui';
import { AppServiceDialogResponses } from '../../constants';
import { SiteTreeItem } from '../../explorer/SiteTreeItem';
import { TrialAppTreeItem } from '../../explorer/trialApp/TrialAppTreeItem';
import { WebAppTreeItem } from '../../explorer/WebAppTreeItem';
import { ext } from '../../extensionVariables';
import { localize } from '../../localize';
import { cloneTrialApp } from '../trialApp/cloneTrialApp';

export async function deployTrialApp(context: IActionContext, trialAppTreeItem: TrialAppTreeItem): Promise<void> {

    const workspaceFolders: WorkspaceFolder[] | undefined = workspace.workspaceFolders;
    const trialAppPath = workspaceFolders?.find((folder: WorkspaceFolder) => {
        return folder.name === trialAppTreeItem.metadata.siteName;
    });

    if (trialAppPath) {
        const title: string = localize('deploying', 'Deploying to "{0}"... Check [output window](command:{1}) for status.', trialAppTreeItem.metadata.siteName, `${ext.prefix}.showOutputChannel`);
        await window.withProgress({ location: ProgressLocation.Notification, title }, async () => {

            // the -a flag stages all changes before committing
            ext.outputChannel.appendLog(localize('committingChanges', 'Committing changes'));
            await git(trialAppPath.uri.fsPath).commit('Deploy trial app', undefined, { '-a': null });

            ext.outputChannel.appendLog(localize('pushingToRemote', 'Pushing to deploy changes'));
            await commands.executeCommand('git.push');

            const message: string = localize('deployCompleted', 'Deployment to trial app "{0}" completed.', trialAppTreeItem.metadata.siteName);
            ext.outputChannel.appendLog(message);

            const browseWebsiteBtn: MessageItem = { title: localize('browseWebsite', 'Browse Website') };
            // don't wait
            window.showInformationMessage(message, browseWebsiteBtn, AppServiceDialogResponses.viewOutput).then(async (result: MessageItem | undefined) => {
                await callWithTelemetryAndErrorHandling('postDeploy', async (actionContext: IActionContext) => {
                    actionContext.telemetry.properties.dialogResult = result?.title;
                    if (result === AppServiceDialogResponses.viewOutput) {
                        ext.outputChannel.show();
                    } else if (result === browseWebsiteBtn) {
                        await trialAppTreeItem.browse();
                    }
                });
            });
        });
    } else {
        return await deployTrialAppError(context, trialAppTreeItem);
    }
}

export async function getDeployNodeWithTrialApp(context: IActionContext, target?: vscode.Uri | TrialAppTreeItem | SiteTreeItem): Promise<vscode.Uri | SiteTreeItem | TrialAppTreeItem | undefined> {
    if (!target) {
        const trialApp: TrialAppTreeItem | undefined = ext.azureAccountTreeItem.trialAppTreeItem;
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

async function deployTrialAppError(context: IActionContext, trialAppNode: TrialAppTreeItem): Promise<void> {
    const message: string = localize('unableToDeployTrialApp', 'Unable to deploy trial app: Clone trial app source and open folder in VS Code to deploy');
    const clone: MessageItem = { title: 'Clone trial app' };
    await window.showErrorMessage(message, clone).then(async (value: MessageItem) => {
        if (value === clone) {
            await cloneTrialApp(context, trialAppNode);
        }
    });
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteConfigResource, User } from 'azure-arm-website/lib/models';
import * as portfinder from 'portfinder';
import * as vscode from 'vscode';
import { SiteClient, TunnelProxy } from 'vscode-azureappservice';
import { callWithTelemetryAndErrorHandling, IActionContext } from 'vscode-azureextensionui';
import { SiteTreeItem } from '../../explorer/SiteTreeItem';
import { WebAppTreeItem } from '../../explorer/WebAppTreeItem';
import { ext } from '../../extensionVariables';
import * as remoteDebug from './remoteDebugCommon';

const remoteSsh: Map<string, boolean> = new Map();

export async function startRemoteSsh(node?: SiteTreeItem): Promise<void> {
    if (!node) {
        node = <SiteTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue);
    }
    if (remoteSsh.get(node.root.client.fullName)) {
        throw new Error(`Azure Remote SSH is currently starting or already started for "${node.root.client.fullName}".`);
    }

    remoteSsh.set(node.root.client.fullName, true);
    try {
        await startRemoteSshInternal(node);
    } catch (error) {
        remoteSsh.set(node.root.client.fullName, false);
        throw error;
    }
}

async function startRemoteSshInternal(node: SiteTreeItem): Promise<void> {
    const siteClient: SiteClient = node.root.client;

    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async (progress: vscode.Progress<{}>): Promise<void> => {
        remoteDebug.reportMessage('Fetching site configuration...', progress);
        const siteConfig: SiteConfigResource = await siteClient.getSiteConfig();
        const oldSetting: boolean = <boolean>siteConfig.remoteDebuggingEnabled;
        if (!siteConfig.linuxFxVersion) {
            throw new Error('Azure Remote SSH is only supported for Linux web apps.');
        }

        // should always be an unbound port
        const portNumber: number = await portfinder.getPortPromise();
        remoteDebug.reportMessage('Checking app settings...', progress);
        // remote debugging has to be disabled in order to tunnel to the 2222 port
        await remoteDebug.setRemoteDebug(false, undefined /*skips confirmation*/, undefined, siteClient, siteConfig, progress);

        remoteDebug.reportMessage('Starting tunnel proxy...', progress);

        const publishCredential: User = await siteClient.getWebAppPublishCredential();
        const tunnelProxy: TunnelProxy = new TunnelProxy(portNumber, siteClient, publishCredential);
        await callWithTelemetryAndErrorHandling('appService.remoteSshStartProxy', async function (this: IActionContext): Promise<void> {
            this.suppressErrorDisplay = true;
            this.rethrowError = true;

            await tunnelProxy.startProxy();
            vscode.window.showInformationMessage('Your password: Docker!');
            const shellExecution: vscode.ShellExecution = new vscode.ShellExecution(`ssh -c aes256-cbc root@127.0.0.1 -p ${portNumber}`);
            const task: vscode.Task = new vscode.Task({ type: `SSH - ${node.root.client.fullName}` }, `Azure Remote SSH - ${node.root.client.fullName}`, `ssh`, shellExecution);
            await vscode.tasks.executeTask(task);
            vscode.tasks.onDidEndTask(async (e: vscode.TaskEndEvent) => {
                if (e.execution.task.name === task.name) {
                    // clean up if the SSH task ends
                    if (tunnelProxy !== undefined) {
                        tunnelProxy.dispose();
                    }
                    /**
                     * @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
                     * @    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!
                     * @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
                     * IT IS POSSIBLE THAT SOMEONE IS DOING SOMETHING NASTY!
                     */
                    // This is to handle the error above is the port has already been set in .ssh/known-hosts
                    const shellRemoveKeygen: vscode.ShellExecution = new vscode.ShellExecution(`ssh-keygen -R [127.0.0.1]:${portNumber}`);
                    const taskRemoveKeygen: vscode.Task = new vscode.Task({ type: shellRemoveKeygen.commandLine }, shellRemoveKeygen.commandLine, `ssh-keygen`, shellRemoveKeygen);
                    taskRemoveKeygen.isBackground = true;
                    await vscode.tasks.executeTask(taskRemoveKeygen);

                    remoteSsh.set(node.root.client.fullName, false);
                    ext.outputChannel.appendLine(`Azure Remote SSH for "${node.root.client.fullName}" has disconnected.`);
                    await remoteDebug.setRemoteDebug(oldSetting, undefined/*skips confirmation*/, undefined, siteClient, siteConfig, progress);
                }
            });

        });
    });
}

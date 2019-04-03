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
import { delay } from '../../utils/delay';
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
    const siteConfig: SiteConfigResource = await siteClient.getSiteConfig();
    const oldSetting: boolean = <boolean>siteConfig.remoteDebuggingEnabled;
    // should always be an unbound port
    const portNumber: number = await portfinder.getPortPromise();

    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async (progress: vscode.Progress<{}>): Promise<void> => {
        if (!siteConfig.linuxFxVersion) {
            throw new Error('Azure Remote SSH is only supported for Linux web apps.');
        }

        remoteDebug.reportMessage('Checking app settings...', progress);

        // remote debugging has to be disabled in order to tunnel to the 2222 port
        await remoteDebug.setRemoteDebug(false, undefined /*skips confirmation*/, undefined, siteClient, siteConfig);

        remoteDebug.reportMessage('Starting tunnel proxy...', progress);

        const publishCredential: User = await siteClient.getWebAppPublishCredential();
        const tunnelProxy: TunnelProxy = new TunnelProxy(portNumber, siteClient, publishCredential);
        await callWithTelemetryAndErrorHandling('appService.remoteSshStartProxy', async function (this: IActionContext): Promise<void> {
            this.rethrowError = true;
            await tunnelProxy.startProxy(2222);
            await connectToTunnelProxy(tunnelProxy);
        });
    });

    async function connectToTunnelProxy(tunnelProxy: TunnelProxy): Promise<void> {
        const sshTerminalName: string = `${node.root.client.fullName} - Remote SSH`;
        // -o StrictHostKeyChecking=no doesn't prompt for adding to hosts
        // -o "UserKnownHostsFile /dev/null" doesn't add host to known_user file
        // -o "LogLevel ERROR" doesn't display Warning: Permanently added 'hostname,ip' (RSA) to the list of known hosts.
        const sshCommand: string = `ssh -c aes256-cbc -o StrictHostKeyChecking=no -o "UserKnownHostsFile /dev/null" -o "LogLevel ERROR" root@127.0.0.1 -p ${portNumber}`;
        const terminal: vscode.Terminal = vscode.window.createTerminal(sshTerminalName);

        // because the container needs time to respond, there needs to be a delay between connecting and entering password
        terminal.sendText(sshCommand, true);
        await delay(3000);
        terminal.sendText('Docker!', true);
        terminal.show();
        ext.context.subscriptions.push(terminal);

        vscode.window.onDidCloseTerminal(async (e: vscode.Terminal) => {
            if (e.processId === terminal.processId) {
                // clean up if the SSH task ends
                if (tunnelProxy !== undefined) {
                    tunnelProxy.dispose();
                }
                remoteSsh.set(node.root.client.fullName, false);
                ext.outputChannel.appendLine(`Azure Remote SSH for "${node.root.client.fullName}" has disconnected.`);
                await remoteDebug.setRemoteDebug(oldSetting, undefined/*skips confirmation*/, undefined, siteClient, siteConfig);
            }
        });
    }
}

export async function stopRemoteSsh(node?: SiteTreeItem): Promise<void> {
    if (!node) {
        node = <SiteTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue);
    }

    if (!remoteSsh.get(node.root.client.fullName)) {
        throw new Error(`Azure Remote SSH is not currently running for "${node.root.client.fullName}".`);
    }
    const sshTerminalName: string = `${node.root.client.fullName} - Remote SSH`;
    for (const terminal of vscode.window.terminals) {
        if (terminal.name === sshTerminalName) {
            terminal.dispose();
            return;
        }
    }

    throw new Error(`Terminal "${sshTerminalName}" could not be found.`);
}

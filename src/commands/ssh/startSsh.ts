/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteConfigResource, User } from 'azure-arm-website/lib/models';
import * as portfinder from 'portfinder';
import * as vscode from 'vscode';
import { SiteClient, TunnelProxy } from 'vscode-azureappservice';
import { SiteTreeItem } from '../../explorer/SiteTreeItem';
import { WebAppTreeItem } from '../../explorer/WebAppTreeItem';
import { ext } from '../../extensionVariables';
import { delay } from '../../utils/delay';
import * as remoteDebug from '../remoteDebug/remoteDebugCommon';

export type sshTerminal = {
    running: boolean,
    terminal: vscode.Terminal | undefined
};

export const sshSessionsMap: Map<string, sshTerminal> = new Map();

export async function startSsh(node?: SiteTreeItem): Promise<void> {
    if (!node) {
        node = <SiteTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue);
    }

    const currentSshTerminal: sshTerminal | undefined = sshSessionsMap.get(node.root.client.fullName);
    if (currentSshTerminal && currentSshTerminal.running) {
        throw new Error(`Azure SSH is currently starting or already started for "${node.root.client.fullName}".`);
    }

    try {
        sshSessionsMap.set(node.root.client.fullName, { running: true, terminal: undefined });
        await startSshInternal(node);
    } catch (error) {
        sshSessionsMap.set(node.root.client.fullName, { running: false, terminal: undefined });
        throw error;
    }
}

async function startSshInternal(node: SiteTreeItem): Promise<void> {
    const siteClient: SiteClient = node.root.client;
    const siteConfig: SiteConfigResource = await siteClient.getSiteConfig();

    // should always be an unbound port
    const localHostPortNumber: number = await portfinder.getPortPromise();
    const sshPortNumber: number = 2222;
    const confirmDisableMessage: string = 'The app configuration will be updated to disable remote debugging and restarted. Would you like to continue?';

    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async (progress: vscode.Progress<{}>): Promise<void> => {
        if (!siteClient.isLinux) {
            throw new Error('Azure SSH is only supported for Linux web apps.');
        }

        remoteDebug.reportMessage('Checking app settings...', progress);

        // remote debugging has to be disabled in order to tunnel to the 2222 port
        await remoteDebug.setRemoteDebug(false, confirmDisableMessage, undefined, siteClient, siteConfig);

        remoteDebug.reportMessage('Initializing SSH...', progress);
        const publishCredential: User = await siteClient.getWebAppPublishCredential();
        const tunnelProxy: TunnelProxy = new TunnelProxy(localHostPortNumber, sshPortNumber, siteClient, publishCredential);

        await tunnelProxy.startProxy();

        remoteDebug.reportMessage('Connecting to SSH...', progress);
        await connectToTunnelProxy(tunnelProxy);
    });

    async function connectToTunnelProxy(tunnelProxy: TunnelProxy): Promise<void> {
        const sshTerminalName: string = `${node.root.client.fullName} - SSH`;
        // -o StrictHostKeyChecking=no doesn't prompt for adding to hosts
        // -o "UserKnownHostsFile /dev/null" doesn't add host to known_user file
        // -o "LogLevel ERROR" doesn't display Warning: Permanently added 'hostname,ip' (RSA) to the list of known hosts.
        const sshCommand: string = `ssh -c aes256-cbc -o StrictHostKeyChecking=no -o "UserKnownHostsFile /dev/null" -o "LogLevel ERROR" root@127.0.0.1 -p ${localHostPortNumber}`;
        const terminal: vscode.Terminal = vscode.window.createTerminal(sshTerminalName);

        // because the container needs time to respond, there needs to be a delay between connecting and entering password
        terminal.sendText(sshCommand, true);
        await delay(3000);
        terminal.sendText('Docker!', true);
        terminal.show();
        ext.context.subscriptions.push(terminal);
        sshSessionsMap.set(node.root.client.fullName, { running: true, terminal: terminal });

        vscode.window.onDidCloseTerminal(async (e: vscode.Terminal) => {
            if (e.processId === terminal.processId) {
                // clean up if the SSH task ends
                if (tunnelProxy !== undefined) {
                    tunnelProxy.dispose();
                }

                sshSessionsMap.set(node.root.client.fullName, { running: false, terminal: undefined });
                ext.outputChannel.appendLine(`Azure SSH for "${node.root.client.fullName}" has disconnected.`);
            }
        });
    }
}

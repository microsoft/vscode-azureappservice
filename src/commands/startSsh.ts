/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteConfigResource, User } from 'azure-arm-website/lib/models';
import * as portfinder from 'portfinder';
import * as vscode from 'vscode';
import { SiteClient, TunnelProxy } from 'vscode-azureappservice';
import { SiteTreeItem } from '../explorer/SiteTreeItem';
import { WebAppTreeItem } from '../explorer/WebAppTreeItem';
import { ext } from '../extensionVariables';
import { delay } from '../utils/delay';
import * as remoteDebug from './remoteDebug/remoteDebugCommon';

export type sshTerminal = {
    starting: boolean,
    terminal: vscode.Terminal | undefined,
    tunnel: TunnelProxy | undefined,
    localPort: number | undefined
};

export const sshSessionsMap: Map<string, sshTerminal> = new Map();

export async function startSsh(node?: SiteTreeItem): Promise<void> {
    if (!node) {
        node = <SiteTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue);
    }

    const currentSshTerminal: sshTerminal | undefined = sshSessionsMap.get(node.root.client.fullName);
    if (currentSshTerminal) {
        if (currentSshTerminal.starting) {
            throw new Error(`Azure SSH is currently starting or already started for "${node.root.client.fullName}".`);
        } else if (currentSshTerminal.tunnel && currentSshTerminal.localPort !== undefined) {
            await connectToTunnelProxy(node, currentSshTerminal.tunnel, currentSshTerminal.localPort);
            return;
        }
    }

    try {
        sshSessionsMap.set(node.root.client.fullName, { starting: true, terminal: undefined, tunnel: undefined, localPort: undefined });
        await startSshInternal(node);
    } catch (error) {
        sshSessionsMap.delete(node.root.client.fullName);
        throw error;
    }
}

async function startSshInternal(node: SiteTreeItem): Promise<void> {
    const siteClient: SiteClient = node.root.client;
    if (!siteClient.isLinux) {
        throw new Error('Azure SSH is only supported for Linux web apps.');
    }

    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async (progress: vscode.Progress<{}>): Promise<void> => {

        remoteDebug.reportMessage('Checking app settings...', progress);

        const confirmDisableMessage: string = 'Remote debugging must be disabled in order to SSH. This will restart the app.';
        const siteConfig: SiteConfigResource = await siteClient.getSiteConfig();
        // remote debugging has to be disabled in order to tunnel to the 2222 port
        await remoteDebug.setRemoteDebug(false, confirmDisableMessage, undefined, siteClient, siteConfig, progress);

        remoteDebug.reportMessage('Initializing SSH...', progress);
        const publishCredential: User = await siteClient.getWebAppPublishCredential();
        const localHostPortNumber: number = await portfinder.getPortPromise();
        // should always be an unbound port
        const tunnelProxy: TunnelProxy = new TunnelProxy(localHostPortNumber, siteClient, publishCredential, true);

        await tunnelProxy.startProxy();

        remoteDebug.reportMessage('Connecting to SSH...', progress);
        await connectToTunnelProxy(node, tunnelProxy, localHostPortNumber);
    });
}

async function connectToTunnelProxy(node: SiteTreeItem, tunnelProxy: TunnelProxy, port: number): Promise<void> {
    const sshTerminalName: string = `${node.root.client.fullName} - SSH`;
    // -o StrictHostKeyChecking=no doesn't prompt for adding to hosts
    // -o "UserKnownHostsFile /dev/null" doesn't add host to known_user file
    // -o "LogLevel ERROR" doesn't display Warning: Permanently added 'hostname,ip' (RSA) to the list of known hosts.
    const sshCommand: string = `ssh -c aes256-cbc -o StrictHostKeyChecking=no -o "UserKnownHostsFile /dev/null" -o "LogLevel ERROR" root@127.0.0.1 -p ${port}`;

    // if this terminal already exists, just reuse it otherwise create a new terminal.
    // tslint:disable-next-line:strict-boolean-expressions
    const terminal: vscode.Terminal = vscode.window.terminals.find((activeTerminal: vscode.Terminal) => { return activeTerminal.name === sshTerminalName; }) || vscode.window.createTerminal(sshTerminalName);

    terminal.sendText(sshCommand, true);
    // because the container needs time to respond, there needs to be a delay between connecting and entering password
    // this is a workaround and is being tracked: https://github.com/Microsoft/vscode-azureappservice/issues/932
    await delay(3000);

    // The default password for logging into the container (after you have SSHed in) is Docker!
    terminal.sendText('Docker!', true);
    terminal.show();
    ext.context.subscriptions.push(terminal);

    sshSessionsMap.set(node.root.client.fullName, { starting: false, terminal: terminal, tunnel: tunnelProxy, localPort: port });

    const onCloseEvent: vscode.Disposable = vscode.window.onDidCloseTerminal(async (e: vscode.Terminal) => {
        if (e.processId === terminal.processId) {
            // clean up if the SSH task ends
            if (tunnelProxy !== undefined) {
                tunnelProxy.dispose();
            }

            sshSessionsMap.delete(node.root.client.fullName)
            ext.outputChannel.appendLine(`Azure SSH for "${node.root.client.fullName}" has disconnected.`);

            // clean this up after we've disposed the terminal and reset the map
            onCloseEvent.dispose();
        }
    });
}

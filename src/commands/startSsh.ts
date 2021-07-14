/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from '@azure/arm-appservice';
import * as portfinder from 'portfinder';
import * as vscode from 'vscode';
import { reportMessage, setRemoteDebug, SiteClient, TunnelProxy } from 'vscode-azureappservice';
import { IActionContext } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { SiteTreeItem } from '../tree/SiteTreeItem';
import { WebAppTreeItem } from '../tree/WebAppTreeItem';
import { CommandLineBuilder } from './commandLineBuilder';
import { ExtPseudoterminal } from './ExtPseudoTerminal';

export type sshTerminal = {
    starting: boolean,
    terminal: vscode.Terminal | undefined,
    tunnel: TunnelProxy | undefined,
    localPort: number | undefined
};

export const sshSessionsMap: Map<string, sshTerminal> = new Map<string, sshTerminal>();

export async function startSsh(context: IActionContext, node?: SiteTreeItem): Promise<void> {
    if (!node) {
        node = <SiteTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue, context);
    }

    const currentSshTerminal: sshTerminal | undefined = sshSessionsMap.get(node.root.client.fullName);
    if (currentSshTerminal) {
        if (currentSshTerminal.starting) {
            throw new Error(localize('sshStartedError', 'Azure SSH is currently starting or already started for "{0}".', node.root.client.fullName));
        } else if (currentSshTerminal.tunnel && currentSshTerminal.localPort !== undefined) {
            await connectToTunnelProxy(node, currentSshTerminal.tunnel, currentSshTerminal.localPort);
            return;
        }
    }

    try {
        sshSessionsMap.set(node.root.client.fullName, { starting: true, terminal: undefined, tunnel: undefined, localPort: undefined });
        await startSshInternal(context, node);
    } catch (error) {
        sshSessionsMap.delete(node.root.client.fullName);
        throw error;
    }
}

async function startSshInternal(context: IActionContext, node: SiteTreeItem): Promise<void> {
    const siteClient: SiteClient = node.root.client;
    if (!siteClient.isLinux) {
        throw new Error(localize('sshLinuxError', 'Azure SSH is only supported for Linux web apps.'));
    }

    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, cancellable: true }, async (progress, token): Promise<void> => {

        reportMessage(localize('checking', 'Checking app settings...'), progress, token);

        const confirmDisableMessage: string = localize('confirmDisable', 'Remote debugging must be disabled in order to SSH. This will restart the app.');
        const siteConfig: WebSiteManagementModels.SiteConfigResource = await siteClient.getSiteConfig();
        // remote debugging has to be disabled in order to tunnel to the 2222 port
        await setRemoteDebug(context, false, confirmDisableMessage, undefined, siteClient, siteConfig, progress, token);

        reportMessage(localize('initSsh', 'Initializing SSH...'), progress, token);
        const publishCredential: WebSiteManagementModels.User = await siteClient.getWebAppPublishCredential();
        const localHostPortNumber: number = await portfinder.getPortPromise();
        // should always be an unbound port
        const tunnelProxy: TunnelProxy = new TunnelProxy(localHostPortNumber, siteClient, publishCredential, true);

        await tunnelProxy.startProxy(token);

        reportMessage(localize('connectingSsh', 'Connecting to SSH...'), progress, token);
        await connectToTunnelProxy(node, tunnelProxy, localHostPortNumber);
    });
}

async function connectToTunnelProxy(node: SiteTreeItem, tunnelProxy: TunnelProxy, port: number): Promise<void> {
    const sshTerminalName: string = `${node.root.client.fullName} - SSH`;
    // -o StrictHostKeyChecking=no doesn't prompt for adding to hosts
    // -o "UserKnownHostsFile /dev/null" doesn't add host to known_user file
    // -o "LogLevel ERROR" doesn't display Warning: Permanently added 'hostname,ip' (RSA) to the list of known hosts.
    const sshCommand: string = `ssh -c aes256-cbc -o StrictHostKeyChecking=no -o "UserKnownHostsFile /dev/null" -o "LogLevel ERROR" root@127.0.0.1 -p ${port}`;

    const command = CommandLineBuilder.create('ssh')
        .withNamedArg('-c', 'aes256-cbc')
        .withNamedArg('-o', 'StrictHostKeyChecking=no')
        .withNamedArg('-o', 'UserKnownHostsFile /dev/null')
        .withNamedArg('-o', 'LogLevel ERROR')
        .withArg('root@127.0.0.1')
        .withNamedArg('-p', port.toString());

    // const shellTask: vscode.Task = new vscode.Task({ type: 'sshShell' }, vscode.TaskScope.Workspace, 'sshToWeb', 'ssh', new vscode.ShellExecution(command.build()));

    // eslint-disable-next-line @typescript-eslint/require-await
    const task: vscode.Task = new vscode.Task({ type: 'sshToWeb' }, vscode.TaskScope.Workspace, 'sshToWeb', 'ssh', new vscode.CustomExecution(async function (_resolvedDefinitions: vscode.TaskDefinition): Promise<vscode.Pseudoterminal> {
        return new ExtPseudoterminal(command);
    }));

    await vscode.tasks.executeTask(task);
    // await vscode.tasks.executeTask(shellTask);

    // if this terminal already exists, just reuse it otherwise create a new terminal.
    // const terminal: vscode.Terminal = vscode.window.terminals.find((activeTerminal: vscode.Terminal) => { return activeTerminal.name === sshTerminalName; }) || vscode.window.createTerminal(sshTerminalName);

    // terminal.sendText(sshCommand, true);
    // // because the container needs time to respond, there needs to be a delay between connecting and entering password
    // // this is a workaround and is being tracked: https://github.com/Microsoft/vscode-azureappservice/issues/932
    // await delay(3000);

    // // The default password for logging into the container (after you have SSHed in) is Docker!
    // terminal.sendText('Docker!', true);
    // terminal.show();
    // ext.context.subscriptions.push(terminal);

    // sshSessionsMap.set(node.root.client.fullName, { starting: false, terminal: terminal, tunnel: tunnelProxy, localPort: port });

    // const onCloseEvent: vscode.Disposable = vscode.window.onDidCloseTerminal((e: vscode.Terminal) => {
    //     if (e.processId === terminal.processId) {
    //         // clean up if the SSH task ends
    //         if (tunnelProxy !== undefined) {
    //             tunnelProxy.dispose();
    //         }

    //         sshSessionsMap.delete(node.root.client.fullName);
    //         ext.outputChannel.appendLog(localize('sshDisconnected', 'Azure SSH for "{0}" has disconnected.', node.root.client.fullName));

    //         // clean this up after we've disposed the terminal and reset the map
    //         onCloseEvent.dispose();
    //     }
    // });
}

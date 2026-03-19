/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type SiteConfigResource } from '@azure/arm-appservice';
import { TunnelProxy, reportMessage, setRemoteDebug } from '@microsoft/vscode-azext-azureappservice';
import { findFreePort, type IActionContext } from '@microsoft/vscode-azext-utils';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { type SiteTreeItem } from '../tree/SiteTreeItem';
import { pickWebApp } from '../utils/pickWebApp';

export type sshTerminal = {
    starting: boolean,
    terminal: vscode.Terminal | undefined,
    tunnel: TunnelProxy | undefined,
    localPort: number | undefined
};

export const sshSessionsMap: Map<string, sshTerminal> = new Map<string, sshTerminal>();

export const sshURL = 'root@127.0.0.1';

const defaultContainerPassword = 'Docker!';

/**
 * Returns the path to a temporary script that outputs the default SSH password.
 * Used with SSH_ASKPASS so the password is entered automatically.
 */
function getAskpassScriptPath(): string {
    const tmpDir = os.tmpdir();
    const isWindows = process.platform === 'win32';
    const scriptName = isWindows ? 'vscode-appservice-askpass.cmd' : 'vscode-appservice-askpass.sh';
    const scriptPath = path.join(tmpDir, scriptName);

    if (!fs.existsSync(scriptPath)) {
        const content = isWindows
            ? `@echo off\r\necho ${defaultContainerPassword}\r\n`
            : `#!/bin/sh\necho '${defaultContainerPassword}'\n`;
        fs.writeFileSync(scriptPath, content, { mode: isWindows ? 0o644 : 0o755 });
    }

    return scriptPath;
}
export async function startSsh(context: IActionContext, node?: SiteTreeItem): Promise<void> {
    node ??= await pickWebApp(context);
    await node.initSite(context);
    const currentSshTerminal: sshTerminal | undefined = sshSessionsMap.get(node.site.fullName);
    if (currentSshTerminal) {
        if (currentSshTerminal.starting) {
            throw new Error(localize('sshStartedError', 'Azure SSH is currently starting or already started for "{0}".', node.site.fullName));
        } else if (currentSshTerminal.tunnel && currentSshTerminal.localPort !== undefined) {
            connectToTunnelProxy(node, currentSshTerminal.tunnel, currentSshTerminal.localPort);
            return;
        }
    }

    try {
        sshSessionsMap.set(node.site.fullName, { starting: true, terminal: undefined, tunnel: undefined, localPort: undefined });
        await startSshInternal(context, node);
    } catch (error) {
        sshSessionsMap.delete(node.site.fullName);
        throw error;
    }
}

async function startSshInternal(context: IActionContext, node: SiteTreeItem): Promise<void> {
    await node.initSite(context);
    if (!node.site.isLinux) {
        throw new Error(localize('sshLinuxError', 'Azure SSH is only supported for Linux web apps.'));
    }

    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, cancellable: true }, async (progress, token): Promise<void> => {

        reportMessage(localize('checking', 'Checking app settings...'), progress, token);

        const client = await node.site.createClient(context);
        const confirmDisableMessage: string = localize('confirmDisable', 'Remote debugging must be disabled in order to SSH. This will restart the app.');
        const siteConfig: SiteConfigResource = await client.getSiteConfig();
        // remote debugging has to be disabled in order to tunnel to the 2222 port
        await setRemoteDebug(context, false, confirmDisableMessage, undefined, node.site, siteConfig, progress, token);

        reportMessage(localize('initSsh', 'Initializing SSH...'), progress, token);

        const localHostPortNumber: number = await findFreePort();

        // should always be an unbound port
        const tunnelProxy: TunnelProxy = new TunnelProxy(localHostPortNumber, node.site, node.subscription.credentials, true);
        await tunnelProxy.startProxy(context, token);

        reportMessage(localize('connectingSsh', 'Connecting to SSH...'), progress, token);
        connectToTunnelProxy(node, tunnelProxy, localHostPortNumber);
    });
}

function connectToTunnelProxy(node: SiteTreeItem, tunnelProxy: TunnelProxy, port: number): void {
    // site will be initialized by startSshInternal, so we can safely use it here
    const sshTerminalName: string = `${node.site.fullName} - SSH`;

    // Close any existing terminal with this name to ensure fresh env vars
    const existingTerminal = vscode.window.terminals.find((t: vscode.Terminal) => t.name === sshTerminalName);
    if (existingTerminal) {
        existingTerminal.dispose();
    }

    const askpassScript = getAskpassScriptPath();

    // -o StrictHostKeyChecking=no doesn't prompt for adding to hosts
    // -o "UserKnownHostsFile /dev/null" doesn't add host to known_user file
    // -o "LogLevel ERROR" doesn't display Warning: Permanently added 'hostname,ip' (RSA) to the list of known hosts.
    const sshCommand: string = `ssh -o StrictHostKeyChecking=no -o "UserKnownHostsFile /dev/null" -o "LogLevel ERROR" ${sshURL} -p ${port}`;

    // Use SSH_ASKPASS to provide the default container password automatically.
    // SSH_ASKPASS_REQUIRE=prefer tells OpenSSH 8.4+ to use the askpass program even with a TTY.
    const terminal: vscode.Terminal = vscode.window.createTerminal({
        name: sshTerminalName,
        env: {
            SSH_ASKPASS: askpassScript,
            SSH_ASKPASS_REQUIRE: 'prefer',
            DISPLAY: ':0',
        },
    });
    terminal.sendText(sshCommand, true);

    terminal.show();
    ext.context.subscriptions.push(terminal);

    sshSessionsMap.set(node.site.fullName, { starting: false, terminal: terminal, tunnel: tunnelProxy, localPort: port });

    const onCloseEvent: vscode.Disposable = vscode.window.onDidCloseTerminal((e: vscode.Terminal) => {
        if (e.processId === terminal.processId) {
            if (tunnelProxy !== undefined) {
                tunnelProxy.dispose();
            }

            sshSessionsMap.delete(node.site.fullName);
            ext.outputChannel.appendLog(localize('sshDisconnected', 'Azure SSH for "{0}" has disconnected.', node.site.fullName));

            // clean this up after we've disposed the terminal and reset the map
            onCloseEvent.dispose();
        }
    });
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { commands, ProgressLocation, window } from "vscode";
import { DialogResponses } from "vscode-azureextensionui";
import { SiteTreeItem } from "../explorer/SiteTreeItem";
import { ext } from '../extensionVariables';

export async function enableFileLogging(node: SiteTreeItem): Promise<void> {
    await ext.ui.showWarningMessage(`Do you want to enable file logging for ${node.root.client.fullName}? The web app will be restarted.`, { modal: true }, DialogResponses.yes);
    const enablingLogging: string = `Enabling Logging for "${node.root.client.fullName}"...`;
    const enabledLogging: string = `Enabled Logging for "${node.root.client.fullName}".`;
    await window.withProgress({ location: ProgressLocation.Notification, title: enablingLogging }, async (): Promise<void> => {
        ext.outputChannel.appendLog(enablingLogging);
        await node.enableHttpLogs();
        await commands.executeCommand('appService.Restart', node);
        window.showInformationMessage(enabledLogging);
        ext.outputChannel.appendLog(enabledLogging);
    });
}

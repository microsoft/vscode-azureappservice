/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { LogFilesTreeItem } from 'vscode-azureappservice';
import { DialogResponses, IActionContext } from 'vscode-azureextensionui';
import { SiteTreeItem } from "../../explorer/SiteTreeItem";
import { WebAppTreeItem } from '../../explorer/WebAppTreeItem';
import { ext } from '../../extensionVariables';

export async function enableFileLogging(context: IActionContext, node?: SiteTreeItem | LogFilesTreeItem): Promise<void> {
    if (!node) {
        node = await ext.tree.showTreeItemPicker<SiteTreeItem>(WebAppTreeItem.contextValue, context);
    }

    if (node instanceof LogFilesTreeItem) {
        // If the entry point was the Log Files node, pass the parent as that's where the logic lives
        node = <SiteTreeItem>node.parent;
    }
    const isEnabled = await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
        p.report({ message: 'Checking container diagnostics settings...' });
        return await (<SiteTreeItem>node).isHttpLogsEnabled();
    });

    if (!isEnabled) {
        await ext.ui.showWarningMessage(`Do you want to enable file logging for ${node.root.client.fullName}? The web app will be restarted.`, { modal: true }, DialogResponses.yes);
        const enablingLogging: string = `Enabling Logging for "${node.root.client.fullName}"...`;
        const enabledLogging: string = `Enabled Logging for "${node.root.client.fullName}".`;
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: enablingLogging }, async (): Promise<void> => {
            ext.outputChannel.appendLog(enablingLogging);
            await (<SiteTreeItem>node).enableHttpLogs();
            await vscode.commands.executeCommand('appService.Restart', node);
            vscode.window.showInformationMessage(enabledLogging);
            ext.outputChannel.appendLog(enabledLogging);
        });
    } else {
        vscode.window.showInformationMessage(`File logging has already been enabled for ${node.root.client.fullName}.`);
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { LogFilesTreeItem } from 'vscode-azureappservice';
import { DialogResponses, IActionContext } from 'vscode-azureextensionui';
import { SiteTreeItem } from "../../explorer/SiteTreeItem";
import { TrialAppTreeItem } from '../../explorer/trialApp/TrialAppTreeItem';
import { WebAppTreeItem } from '../../explorer/WebAppTreeItem';
import { ext } from '../../extensionVariables';

export interface IEnableFileLoggingContext extends IActionContext {
    suppressAlreadyEnabledMessage?: boolean;
}

export async function enableFileLogging(context: IEnableFileLoggingContext, node?: SiteTreeItem | LogFilesTreeItem | TrialAppTreeItem): Promise<void> {
    if (!node) {
        node = await ext.tree.showTreeItemPicker<SiteTreeItem>(WebAppTreeItem.contextValue, context);
    }

    if (node instanceof LogFilesTreeItem) {
        // If the entry point was the Log Files node, pass the parent as that's where the logic lives
        node = <SiteTreeItem>node.parent;
    }

    const siteNode: SiteTreeItem | TrialAppTreeItem = node;

    const isEnabled = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async p => {
        p.report({ message: 'Checking container diagnostics settings...' });
        return await siteNode.isHttpLogsEnabled();
    });

    if (!isEnabled && siteNode instanceof SiteTreeItem && node instanceof SiteTreeItem) {
        await ext.ui.showWarningMessage(`Do you want to enable file logging for ${node.root.client.fullName}? The web app will be restarted.`, { modal: true }, DialogResponses.yes);
        const enablingLogging: string = `Enabling Logging for "${node.root.client.fullName}"...`;
        const enabledLogging: string = `Enabled Logging for "${node.root.client.fullName}".`;
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: enablingLogging }, async (): Promise<void> => {
            ext.outputChannel.appendLog(enablingLogging);
            await siteNode.enableHttpLogs();

            await vscode.commands.executeCommand('appService.Restart', node);
            vscode.window.showInformationMessage(enabledLogging);
            ext.outputChannel.appendLog(enabledLogging);
        });
    } else if (!context.suppressAlreadyEnabledMessage) {
        const fullName: string = (node instanceof TrialAppTreeItem) ? node.client.fullName : node.root.client.fullName;
        vscode.window.showInformationMessage(`File logging has already been enabled for ${fullName}.`);
    }
}

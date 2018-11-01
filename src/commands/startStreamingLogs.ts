/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as appservice from 'vscode-azureappservice';
import { LogStreamTreeItem } from '../explorer/LogStreamTreeItem';
import { SiteTreeItem } from "../explorer/SiteTreeItem";
import { WebAppTreeItem } from '../explorer/WebAppTreeItem';
import { ext } from '../extensionVariables';
import { enableFileLogging } from './enableFileLogging';

export async function startStreamingLogs(node?: SiteTreeItem | LogStreamTreeItem): Promise<void> {
    let siteTreeItem: SiteTreeItem;

    if (!node) {
        siteTreeItem = <WebAppTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue);
    } else if (node instanceof LogStreamTreeItem) {
        siteTreeItem = <SiteTreeItem>node.parent.parent;
    } else {
        siteTreeItem = node;
    }

    const verifyLoggingEnabled: () => Promise<void> = async (): Promise<void> => {
        const isEnabled = await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            p.report({ message: 'Checking container diagnostics settings...' });
            return await siteTreeItem.isHttpLogsEnabled();
        });
        if (!isEnabled) {
            await enableFileLogging(siteTreeItem);
        }
    };

    await appservice.startStreamingLogs(siteTreeItem.root.client, verifyLoggingEnabled, siteTreeItem.logStreamLabel);
}

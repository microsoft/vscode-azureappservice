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
    let logStreamTreeItem: LogStreamTreeItem | undefined;
    let webAppTreeItem: WebAppTreeItem;

    if (!node) {
        webAppTreeItem = <WebAppTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue);
    } else if (node.contextValue === LogStreamTreeItem.contextValue) {
        logStreamTreeItem = <LogStreamTreeItem>node;
        // tslint:disable-next-line:no-non-null-assertion
        webAppTreeItem = <WebAppTreeItem>node.parent!.parent;
    } else {
        webAppTreeItem = <WebAppTreeItem>node;
    }

    const verifyLoggingEnabled: () => Promise<void> = async (): Promise<void> => {
        const isEnabled = await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            p.report({ message: 'Checking container diagnostics settings...' });
            return await webAppTreeItem.isHttpLogsEnabled();
        });
        if (!isEnabled) {
            await enableFileLogging(webAppTreeItem);
        }
    };

    await appservice.startStreamingLogs(webAppTreeItem.root.client, verifyLoggingEnabled, webAppTreeItem.logStreamLabel);
    if (logStreamTreeItem) {
        // don't wait for this refresh
        // tslint:disable-next-line:no-floating-promises
        logStreamTreeItem.refresh();
    }
}

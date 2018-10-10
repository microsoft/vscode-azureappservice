/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as appservice from 'vscode-azureappservice';
import { SiteTreeItem } from "../explorer/SiteTreeItem";
import { WebAppTreeItem } from '../explorer/WebAppTreeItem';
import { ext } from '../extensionVariables';
import { enableFileLogging } from './enableFileLogging';

export async function startStreamingLogs(node?: SiteTreeItem): Promise<void> {
    if (!node) {
        node = <WebAppTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue);
    }

    const verifyLoggingEnabled: () => Promise<void> = async (): Promise<void> => {
        const isEnabled = await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            p.report({ message: 'Checking container diagnostics settings...' });
            // tslint:disable-next-line:no-non-null-assertion
            return await node!.isHttpLogsEnabled();
        });
        if (!isEnabled) {
            // tslint:disable-next-line:no-non-null-assertion
            await enableFileLogging(node!);
        }
    };

    await appservice.startStreamingLogs(node.root.client, verifyLoggingEnabled, node.logStreamLabel);
}

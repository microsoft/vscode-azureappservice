/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as appservice from 'vscode-azureappservice';
import { IAzureNode } from "vscode-azureextensionui";
import { SiteTreeItem } from "../explorer/SiteTreeItem";
import { WebAppTreeItem } from '../explorer/WebAppTreeItem';
import { ext } from '../extensionVariables';
import { enableFileLogging } from './enableFileLogging';

export async function startStreamingLogs(node?: IAzureNode<SiteTreeItem>): Promise<void> {
    if (!node) {
        node = <IAzureNode<WebAppTreeItem>>await ext.tree.showNodePicker(WebAppTreeItem.contextValue);
    }

    const verifyLoggingEnabled: () => Promise<void> = async (): Promise<void> => {
        const isEnabled = await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            p.report({ message: 'Checking container diagnostics settings...' });
            // tslint:disable-next-line:no-non-null-assertion
            return await node!.treeItem.isHttpLogsEnabled();
        });
        if (!isEnabled) {
            // tslint:disable-next-line:no-non-null-assertion
            await enableFileLogging(node!);
        }
    };

    await appservice.startStreamingLogs(node.treeItem.client, verifyLoggingEnabled, node.treeItem.logStreamLabel);
}

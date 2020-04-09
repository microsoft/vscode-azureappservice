/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as appservice from 'vscode-azureappservice';
import { IActionContext } from 'vscode-azureextensionui';
import { SiteTreeItem } from "../../explorer/SiteTreeItem";
import { WebAppTreeItem } from '../../explorer/WebAppTreeItem';
import { ext } from '../../extensionVariables';
import { nonNullValue } from '../../utils/nonNull';
import { enableFileLogging } from './enableFileLogging';

export async function startStreamingLogs(context: IActionContext, node?: SiteTreeItem): Promise<void> {
    if (!node) {
        node = await ext.tree.showTreeItemPicker<WebAppTreeItem>(WebAppTreeItem.contextValue, context);
    }

    const verifyLoggingEnabled: () => Promise<void> = async (): Promise<void> => {
        const isEnabled = await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            p.report({ message: 'Checking container diagnostics settings...' });
            return await nonNullValue(node).isHttpLogsEnabled();
        });
        if (!isEnabled) {
            await enableFileLogging(context, node);
        }
    };

    await appservice.startStreamingLogs(node.root.client, verifyLoggingEnabled, node.logStreamLabel);
}

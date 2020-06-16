/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as appservice from 'vscode-azureappservice';
import { ISimplifiedSiteClient } from 'vscode-azureappservice';
import { IActionContext } from 'vscode-azureextensionui';
import { SiteTreeItem } from '../../explorer/SiteTreeItem';
import { TrialAppTreeItem } from '../../explorer/trialApp/TrialAppTreeItem';
import { WebAppTreeItem } from '../../explorer/WebAppTreeItem';
import { ext } from '../../extensionVariables';
import { enableFileLogging } from './enableFileLogging';

export async function startStreamingLogs(context: IActionContext, node?: SiteTreeItem | TrialAppTreeItem): Promise<void> {
    if (!node) {
        node = await ext.tree.showTreeItemPicker<WebAppTreeItem>(WebAppTreeItem.contextValue, context);
    }

    const verifyLoggingEnabled: () => Promise<void> = async (): Promise<void> => {
        if (node instanceof TrialAppTreeItem) {
            await enableFileLogging({ ...context, suppressAlreadyEnabledMessage: true }, node.logFilesNode);
        } else {
            await enableFileLogging({ ...context, suppressAlreadyEnabledMessage: true }, node);
        }
    };

    const client: ISimplifiedSiteClient = (node instanceof TrialAppTreeItem) ? node.client : node.root.client;
    await appservice.startStreamingLogs(client, verifyLoggingEnabled, node.logStreamLabel);
}

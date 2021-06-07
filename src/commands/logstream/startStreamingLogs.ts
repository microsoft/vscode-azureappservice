/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as appservice from 'vscode-azureappservice';
import { IActionContext } from 'vscode-azureextensionui';
import { ext } from '../../extensionVariables';
import { SiteTreeItem } from '../../tree/SiteTreeItem';
import { WebAppTreeItem } from '../../tree/WebAppTreeItem';
import { enableFileLogging } from './enableFileLogging';

export async function startStreamingLogs(context: IActionContext, node?: SiteTreeItem): Promise<void> {
    if (!node) {
        node = await ext.tree.showTreeItemPicker<WebAppTreeItem>(WebAppTreeItem.contextValue, context);
    }

    const verifyLoggingEnabled: () => Promise<void> = async (): Promise<void> => {
        await enableFileLogging({ ...context, suppressAlreadyEnabledMessage: true }, node);
    };

    await appservice.startStreamingLogs(node.client, verifyLoggingEnabled, node.logStreamLabel);
}

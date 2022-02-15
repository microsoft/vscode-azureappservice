/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as appservice from '@microsoft/vscode-azext-azureappservice';
import { IActionContext } from '@microsoft/vscode-azext-utils';
import { ext } from '../../extensionVariables';
import { SiteTreeItem } from '../../tree/SiteTreeItem';
import { WebAppTreeItem } from '../../tree/WebAppTreeItem';

export async function stopStreamingLogs(context: IActionContext, node?: SiteTreeItem): Promise<void> {
    if (!node) {
        node = await ext.tree.showTreeItemPicker<WebAppTreeItem>(WebAppTreeItem.contextValue, { ...context, suppressCreatePick: true });
    }

    await appservice.stopStreamingLogs(node.site);
}

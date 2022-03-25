/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtParentTreeItem, AzExtTreeItem, IActionContext } from '@microsoft/vscode-azext-utils';
import { ext } from "../../extensionVariables";
import { CosmosDBTreeItem } from '../../tree/CosmosDBTreeItem';
import { nonNullProp } from '../../utils/nonNull';

export async function addCosmosDBConnection(context: IActionContext, node?: AzExtTreeItem): Promise<void> {
    if (!node) {
        node = <CosmosDBTreeItem>await ext.rgApi.tree.showTreeItemPicker([CosmosDBTreeItem.contextValueNotInstalled, CosmosDBTreeItem.contextValueInstalled], context);
    }

    let cosmosDBTreeItem: AzExtParentTreeItem;
    if (node instanceof CosmosDBTreeItem) {
        cosmosDBTreeItem = node;
    } else {
        cosmosDBTreeItem = nonNullProp(node, 'parent');
    }
    await cosmosDBTreeItem.createChild(context);
    await ext.rgApi.tree.refresh(context, cosmosDBTreeItem);
}

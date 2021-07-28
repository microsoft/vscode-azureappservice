/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtParentTreeItem, AzExtTreeItem, IActionContext } from 'vscode-azureextensionui';
import { ext } from "../../extensionVariables";
import { CosmosDBTreeItem } from '../../tree/CosmosDBTreeItem';
import { nonNullProp } from '../../utils/nonNull';

export async function addCosmosDBConnection(context: IActionContext, node?: AzExtTreeItem): Promise<void> {
    if (!node) {
        node = <CosmosDBTreeItem>await ext.tree.showTreeItemPicker([CosmosDBTreeItem.contextValueNotInstalled, CosmosDBTreeItem.contextValueInstalled], context);
    }

    let cosmosDBTreeItem: AzExtParentTreeItem;
    if (node instanceof CosmosDBTreeItem) {
        cosmosDBTreeItem = node;
    } else {
        cosmosDBTreeItem = nonNullProp(node, 'parent');
    }
    await cosmosDBTreeItem.createChild(context);
    await ext.tree.refresh(context, cosmosDBTreeItem);
}

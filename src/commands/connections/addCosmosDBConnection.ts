/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtParentTreeItem, AzureTreeItem, IActionContext } from 'vscode-azureextensionui';
import { CosmosDBTreeItem } from '../../explorer/CosmosDBTreeItem';
import { ext } from "../../extensionVariables";
import { nonNullProp } from '../../utils/nonNull';

export async function addCosmosDBConnection(context: IActionContext, node?: AzureTreeItem): Promise<void> {
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
    await ext.tree.refresh(cosmosDBTreeItem);
}

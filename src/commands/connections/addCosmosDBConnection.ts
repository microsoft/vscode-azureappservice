/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureParentTreeItem, AzureTreeItem } from 'vscode-azureextensionui';
import { CosmosDBTreeItem } from '../../explorer/CosmosDBTreeItem';
import { ext } from "../../extensionVariables";

export async function addCosmosDBConnection(node?: AzureTreeItem): Promise<void> {
    if (!node) {
        node = <CosmosDBTreeItem>await ext.tree.showTreeItemPicker([CosmosDBTreeItem.contextValueNotInstalled, CosmosDBTreeItem.contextValueInstalled]);
    }

    let cosmosDBTreeItem: AzureParentTreeItem;
    if (node instanceof CosmosDBTreeItem) {
        cosmosDBTreeItem = node;
    } else {
        // tslint:disable-next-line:no-non-null-assertion
        cosmosDBTreeItem = node.parent!;
    }
    await cosmosDBTreeItem.createChild();
    await ext.tree.refresh(cosmosDBTreeItem);
}

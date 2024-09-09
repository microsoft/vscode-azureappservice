/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type AzExtParentTreeItem, type AzExtTreeItem, type IActionContext } from '@microsoft/vscode-azext-utils';
import { webAppFilter } from '../../constants';
import { ext } from "../../extensionVariables";
import { CosmosDBTreeItem } from '../../tree/CosmosDBTreeItem';
import { nonNullProp } from '../../utils/nonNull';

export async function addCosmosDBConnection(context: IActionContext, node?: AzExtTreeItem): Promise<void> {
    if (!node) {
        node = await ext.rgApi.pickAppResource<CosmosDBTreeItem>(context, {
            filter: webAppFilter,
            expectedChildContextValue: [CosmosDBTreeItem.contextValueNotInstalled, CosmosDBTreeItem.contextValueInstalled]
        });
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

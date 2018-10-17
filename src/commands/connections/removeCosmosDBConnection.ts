/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CosmosDBDatabase } from '../../explorer/CosmosDBDatabase';
import { ext } from "../../extensionVariables";

export async function removeCosmosDBConnection(node: CosmosDBDatabase): Promise<void> {
    await node.deleteTreeItem();
    await ext.tree.refresh(node.parent);
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CosmosDBConnection } from '../../explorer/CosmosDBConnection';
import { ext } from "../../extensionVariables";

export async function removeCosmosDBConnection(node: CosmosDBConnection): Promise<void> {
    await node.deleteTreeItem();
    await ext.tree.refresh(node.parent);
}

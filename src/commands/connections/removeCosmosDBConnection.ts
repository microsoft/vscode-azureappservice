/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type IActionContext } from '@microsoft/vscode-azext-utils';
import { webAppFilter } from '../../constants';
import { ext } from "../../extensionVariables";
import { CosmosDBConnection } from '../../tree/CosmosDBConnection';

export async function removeCosmosDBConnection(context: IActionContext, node?: CosmosDBConnection): Promise<void> {
    if (!node) {
        node = await ext.rgApi.pickAppResource<CosmosDBConnection>({ ...context, suppressCreatePick: true }, {
            filter: webAppFilter,
            expectedChildContextValue: CosmosDBConnection.contextValue
        });
    }

    await node.deleteTreeItem(context);
    await ext.rgApi.tree.refresh(context, node.parent);
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from '@microsoft/vscode-azext-utils';
import { webAppFilter } from '../../constants';
import { ext } from "../../extensionVariables";
import { CosmosDBConnection } from '../../tree/CosmosDBConnection';

export async function revealConnection(context: IActionContext, node?: CosmosDBConnection): Promise<void> {
    if (!node) {
        node = await ext.rgApi.pickAppResource<CosmosDBConnection>({ ...context, suppressCreatePick: true }, {
            filter: webAppFilter,
            expectedChildContextValue: CosmosDBConnection.contextValue
        });
    }

    await node.cosmosExtensionItem.reveal();
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import { AzureExtensionApiProvider } from 'vscode-azureextensionui/api';
import { ext } from "../../extensionVariables";
import { localize } from '../../localize';
import { CosmosDBConnection } from '../../tree/CosmosDBConnection';
import { nonNullProp } from '../../utils/nonNull';
import { AzureDatabasesExtensionApi } from '../../vscode-cosmos.api';


export async function revealConnection(context: IActionContext, node?: CosmosDBConnection): Promise<void> {
    if (!node) {
        node = await ext.tree.showTreeItemPicker<CosmosDBConnection>(CosmosDBConnection.contextValue, { ...context, suppressCreatePick: true });
    }
    const cosmosDBApi = await getCosmosDBApi();
    const azureData = nonNullProp(node.cosmosExtensionItem, 'azureData');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    cosmosDBApi?.revealTreeItem(azureData.accountId);

}
export async function getCosmosDBApi(): Promise<AzureDatabasesExtensionApi | undefined> {

    const cosmosDBExtension: vscode.Extension<AzureExtensionApiProvider | undefined> | undefined = vscode.extensions.getExtension('ms-azuretools.vscode-cosmosdb');
    let cosmosDBApi: AzureDatabasesExtensionApi;

    try {
        if (!cosmosDBExtension?.isActive) {
            await cosmosDBExtension?.activate();
        }

        // The Cosmos DB extension just recently added support for 'AzureExtensionApiProvider' so we should do an additional check just to makes sure it's defined
        if (cosmosDBExtension?.exports) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            cosmosDBApi = cosmosDBExtension?.exports.getApi<AzureDatabasesExtensionApi>('^1.0.0');
            return cosmosDBApi;
        }
    } catch (error) {
        throw new Error(localize('azureDbError', 'You must have the "Azure Databases" extension installed to perform this operation.'));
    }
}

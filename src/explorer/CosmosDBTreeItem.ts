/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { SiteClient } from 'vscode-azureappservice';
import { IAzureNode, IAzureParentTreeItem, IAzureTreeItem } from 'vscode-azureextensionui';

export class CosmosDBTreeItem implements IAzureParentTreeItem {
    public static contextValue: string = 'CosmosDBConnection';
    public readonly contextValue: string = CosmosDBTreeItem.contextValue;
    public readonly label: string = 'Cosmos DB';

    constructor(readonly client: SiteClient) {
    }

    public async loadMoreChildren(_node: IAzureNode<IAzureTreeItem>, _clearCache: boolean): Promise<IAzureTreeItem[]> {
        const cosmosDB = vscode.extensions.getExtension('ms-azuretools.vscode-cosmosdb');
        if (!cosmosDB) {
            return [{
                contextValue: 'InstallcosmosDBExtension',
                label: 'Install Cosmos DB Extension...',
                commandId: 'appService.InstallCosmosDBExtension',
                isAncestorOf: () => { return false; }
            }];
        }
        throw new Error('Method not implemented.');
    }

    public hasMoreChildren(): boolean {
        return false;
    }
}

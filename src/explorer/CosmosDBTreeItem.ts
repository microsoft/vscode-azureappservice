/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { SiteClient } from 'vscode-azureappservice';
import { IAzureNode, IAzureParentTreeItem, IAzureTreeItem } from 'vscode-azureextensionui';
import { IConnections } from '../commands/connections/IConnections';
import * as constants from '../constants';
import { ConnectionAccountDatabaseTreeItem } from './ConnectionAccountDatabaseTreeItem';

export class CosmosDBTreeItem implements IAzureParentTreeItem {
    public static contextValue: string = 'сosmosDBConnection';
    public readonly contextValue: string = CosmosDBTreeItem.contextValue;
    public readonly label: string = 'Cosmos DB';
    constructor(readonly client: SiteClient) {
    }

    public async loadMoreChildren(_node: IAzureNode<IAzureTreeItem>, _clearCache: boolean): Promise<IAzureTreeItem[]> {
        const cosmosDB = vscode.extensions.getExtension('ms-azuretools.vscode-cosmosdb');
        if (!cosmosDB) {
            return [{
                contextValue: 'InstallCosmosDBExtension',
                label: 'Install Cosmos DB Extension...',
                commandId: 'appService.InstallCosmosDBExtension',
                isAncestorOf: () => { return false; }
            }];
        }
        const workspaceConfig = vscode.workspace.getConfiguration(constants.extensionPrefix);
        const connections = workspaceConfig.get<IConnections[]>(constants.configurationSettings.connections, []);
        // tslint:disable-next-line:strict-boolean-expressions
        const unit = connections.find((x: IConnections) => x.webAppId === this.client.id) || <IConnections>{};
        // tslint:disable-next-line:strict-boolean-expressions
        unit.cosmosDB = unit.cosmosDB || [];
        return unit.cosmosDB.map(connectionId => {
            return new ConnectionAccountDatabaseTreeItem(this.client, connectionId);
        });
    }

    public hasMoreChildren(): boolean {
        return false;
    }
}

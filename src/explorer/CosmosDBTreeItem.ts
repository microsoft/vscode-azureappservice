/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { SiteClient } from 'vscode-azureappservice';
import { IAzureNode, IAzureParentNode, IAzureParentTreeItem, IAzureTreeItem, UserCancelledError } from 'vscode-azureextensionui';
import * as constants from '../constants';
import { CosmosDBDatabase } from './CosmosDBDatabase';

export class CosmosDBTreeItem implements IAzureParentTreeItem {
    public static contextValue: string = 'сosmosDBConnections';
    public readonly contextValue: string = CosmosDBTreeItem.contextValue;
    public readonly label: string = 'Cosmos DB';
    constructor(readonly client: SiteClient) {
    }

    public async loadMoreChildren(_node: IAzureNode<IAzureTreeItem>, _clearCache: boolean): Promise<IAzureTreeItem[]> {
        const cosmosDB = vscode.extensions.getExtension('ms-azuretools.vscode-cosmosdb');
        if (!cosmosDB) {
            return [{
                commandId: 'appService.InstallCosmosDBExtension',
                contextValue: 'InstallCosmosDBExtension',
                label: 'Install Cosmos DB Extension...',
                isAncestorOf: () => { return false; }
            }];
        }
        const workspaceConfig = vscode.workspace.getConfiguration(constants.extensionPrefix);
        const connections = workspaceConfig.get<IConnection[]>(constants.configurationSettings.connections, []);
        // tslint:disable-next-line:strict-boolean-expressions
        const unit = connections.find((x: IConnection) => x.webAppId === this.client.id) || <IConnection>{};
        if (!unit.cosmosDB) {
            return [<IAzureTreeItem>{
                client: this.client,
                commandId: 'appService.AddCosmosDBConnection',
                contextValue: 'AddCosmosDBConnection',
                label: 'Add Cosmos DB Connection...',
                parent: this
            }];
        }
        return [new CosmosDBDatabase(this.client, unit.cosmosDB)];
    }

    public async createChild(node: IAzureParentNode<CosmosDBTreeItem>, showCreatingNode: (label: string) => void): Promise<IAzureTreeItem> {
        const connectionToAdd = <string>await vscode.commands.executeCommand('cosmosDB.api.getDatabase');
        if (!connectionToAdd) {
            throw new UserCancelledError();
        }

        const workspaceConfig = vscode.workspace.getConfiguration(constants.extensionPrefix);
        const connections = workspaceConfig.get<IConnection[]>(constants.configurationSettings.connections, []);
        let connectionUnit = connections.find((x: IConnection) => x.webAppId === node.treeItem.client.id);
        if (!connectionUnit) {
            connectionUnit = <IConnection>{};
            connections.push(connectionUnit);
            connectionUnit.webAppId = node.treeItem.client.id;
            connectionUnit.cosmosDB = connectionToAdd;
            workspaceConfig.update(constants.configurationSettings.connections, connections); showCreatingNode("");
            return new CosmosDBDatabase(this.client, connectionToAdd);
        }
        throw new Error("Impossible to have more than one connection!");
    }

    public hasMoreChildren(): boolean {
        return false;
    }
}

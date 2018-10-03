/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { SiteClient } from 'vscode-azureappservice';
import { IAzureNode, IAzureParentNode, IAzureParentTreeItem, IAzureTreeItem, UserCancelledError } from 'vscode-azureextensionui';
import * as constants from '../constants';
import { CosmosDBDatabase } from './CosmosDBDatabase';

interface IConnections {
    webAppId: string;
    cosmosDB?: string[];
}

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
        const connections = workspaceConfig.get<IConnections[]>(constants.configurationSettings.connections, []);
        // tslint:disable-next-line:strict-boole an-expressions
        const unit = connections.find((x: IConnections) => x.webAppId === this.client.id) || <IConnections>{};
        if (!unit.cosmosDB || unit.cosmosDB.length === 0) {
            return [<IAzureTreeItem>{
                client: this.client,
                commandId: 'appService.AddCosmosDBConnection',
                contextValue: 'AddCosmosDBConnection',
                label: 'Add Cosmos DB Connection...',
                parent: this
            }];
        }
        return unit.cosmosDB.map(connectionId => {
            return new CosmosDBDatabase(this.client, connectionId);
        });
    }

    public async createChild(node: IAzureParentNode<CosmosDBTreeItem>, showCreatingNode: (label: string) => void): Promise<IAzureTreeItem> {
        const connectionToAdd = <string>await vscode.commands.executeCommand('cosmosDB.api.getDatabase');
        if (!connectionToAdd) {
            throw new UserCancelledError();
        }

        const workspaceConfig = vscode.workspace.getConfiguration(constants.extensionPrefix);
        const allConnections = workspaceConfig.get<IConnections[]>(constants.configurationSettings.connections, []);
        let connectionsUnit = allConnections.find((x: IConnections) => x.webAppId === node.treeItem.client.id);
        if (!connectionsUnit) {
            connectionsUnit = <IConnections>{};
            allConnections.push(connectionsUnit);
            connectionsUnit.webAppId = node.treeItem.client.id;
        }

        // tslint:disable-next-line:strict-boolean-expressions
        connectionsUnit.cosmosDB = connectionsUnit.cosmosDB || [];
        if (!connectionsUnit.cosmosDB.find((x: string) => x === connectionToAdd)) {
            connectionsUnit.cosmosDB.push(connectionToAdd);
            workspaceConfig.update(constants.configurationSettings.connections, allConnections);
        }

        showCreatingNode("");
        return new CosmosDBDatabase(this.client, connectionToAdd);
    }

    public async deleteTreeItem(_node: IAzureNode<CosmosDBDatabase>): Promise<void> {
        const connectionToDelete = _node.treeItem.connectionId;
        const workspaceConfig = vscode.workspace.getConfiguration(constants.extensionPrefix);
        const allConnections = workspaceConfig.get<IConnections[]>(constants.configurationSettings.connections, []);

        const connectionsUnit = allConnections.find((x: IConnections) => x.webAppId === _node.treeItem.client.id);
        if (connectionsUnit && connectionsUnit.cosmosDB) {
            const indexToDelete = connectionsUnit.cosmosDB.findIndex((x: string) => x === connectionToDelete);
            if (indexToDelete > -1) {
                connectionsUnit.cosmosDB.splice(indexToDelete, 1);
                workspaceConfig.update(constants.configurationSettings.connections, allConnections);
            }
        }
    }

    public hasMoreChildren(): boolean {
        return false;
    }
}

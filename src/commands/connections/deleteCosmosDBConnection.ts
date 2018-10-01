/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CosmosDBDatabase } from 'src/explorer/CosmosDBDatabase';
import * as vscode from 'vscode';
import { IAzureNode } from 'vscode-azureextensionui';
import * as constants from '../../constants';
import { IConnections } from './IConnections';

export async function deleteCosmosDBConnection(node: IAzureNode<CosmosDBDatabase>): Promise<void> {
    const connectionToDelete = node.treeItem.connectionId;
    const workspaceConfig = vscode.workspace.getConfiguration(constants.extensionPrefix);
    const allConnections = workspaceConfig.get<IConnections[]>(constants.configurationSettings.connections, []);

    const connectionsUnit = allConnections.find((x: IConnections) => x.webAppId === node.treeItem.client.id);
    if (connectionsUnit && connectionsUnit.cosmosDB) {
        const indexToDelete = connectionsUnit.cosmosDB.findIndex((x: string) => x === connectionToDelete);
        if (indexToDelete > -1) {
            connectionsUnit.cosmosDB.splice(indexToDelete, 1);
            workspaceConfig.update(constants.configurationSettings.connections, allConnections);
            // tslint:disable-next-line:no-non-null-assertion
            await node.parent!.refresh();
        }
    }
}

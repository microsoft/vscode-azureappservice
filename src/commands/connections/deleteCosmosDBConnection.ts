/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionAccountDatabaseTreeItem } from 'src/explorer/ConnectionAccountDatabaseTreeItem';
import * as vscode from 'vscode';
import { IAzureNode } from 'vscode-azureextensionui';
import * as constants from '../../constants';
import { IConnections } from './IConnections';

export async function deleteCosmosDBConnection(node: IAzureNode<ConnectionAccountDatabaseTreeItem>): Promise<void> {
    const connectionToDelete = node.treeItem.connectionId;
    const workspaceConfig = vscode.workspace.getConfiguration(constants.extensionPrefix);
    const connections = await workspaceConfig.get<IConnections[]>(constants.configurationSettings.connections, []);
    let indx = connections.findIndex((x: IConnections) => x.webAppId === node.treeItem.client.id);
    if (indx === -1) {
        indx = connections.push(<IConnections>{}) - 1;
        connections[indx].webAppId = node.treeItem.client.id;
    }
    connections[indx].cosmosDB = connections[indx].cosmosDB || [];
    // tslint:disable-next-line:no-non-null-assertion
    const indexToDelete = connections[indx].cosmosDB!.findIndex((x: string) => x === connectionToDelete);
    if (indexToDelete > -1) {
        // tslint:disable-next-line:no-non-null-assertion
        connections[indexToDelete].cosmosDB!.splice(indexToDelete, 1);
        workspaceConfig.update(constants.configurationSettings.connections, connections);
        // tslint:disable-next-line:no-non-null-assertion
        node.parent!.refresh();
    }
}

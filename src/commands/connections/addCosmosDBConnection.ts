/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CosmosDBTreeItem } from 'src/explorer/CosmosDBTreeItem';
import * as vscode from 'vscode';
import { IAzureNode } from 'vscode-azureextensionui';
import * as constants from '../../constants';
import { IConnections } from './IConnections';

export async function addCosmosDBConnection(node: IAzureNode<CosmosDBTreeItem>, connectionToAdd: string): Promise<void> {
    if (!connectionToAdd) {
        return;
    }
    const workspaceConfig = vscode.workspace.getConfiguration(constants.extensionPrefix);
    const connections = workspaceConfig.get<IConnections[]>(constants.configurationSettings.connections, []);
    let indx = connections.findIndex((x: IConnections) => x.webAppId === node.treeItem.client.id);
    if (indx === -1) {
        indx = connections.push(<IConnections>{}) - 1;
        connections[indx].webAppId = node.treeItem.client.id;
    }
    connections[indx].cosmosDB = connections[indx].cosmosDB || [];
    // tslint:disable-next-line:no-non-null-assertion
    if (!connections[indx].cosmosDB!.find((x: string) => x === connectionToAdd)) {
        // tslint:disable-next-line:no-non-null-assertion
        connections[indx].cosmosDB!.push(connectionToAdd);
        workspaceConfig.update(constants.configurationSettings.connections, connections);
        await node.refresh();
    }
}

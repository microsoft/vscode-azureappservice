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
        await node.refresh();
    }
}

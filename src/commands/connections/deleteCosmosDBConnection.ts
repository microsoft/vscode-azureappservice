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
    const allConnections = workspaceConfig.get<IConnections[]>(constants.configurationSettings.connections, []);

    let connectionsUnit = allConnections.find((x: IConnections) => x.webAppId === node.treeItem.client.id);
    // tslint:disable-next-line:strict-boolean-expressions
    connectionsUnit = connectionsUnit || <IConnections>{};
    // tslint:disable-next-line:strict-boolean-expressions
    connectionsUnit.cosmosDB = connectionsUnit.cosmosDB || [];
    const indexToDelete = connectionsUnit.cosmosDB.findIndex((x: string) => x === connectionToDelete);
    if (indexToDelete > -1) {
        connectionsUnit.cosmosDB.splice(indexToDelete, 1);
        workspaceConfig.update(constants.configurationSettings.connections, allConnections);
        // tslint:disable-next-line:no-non-null-assertion
        await node.parent!.refresh();
    }
}

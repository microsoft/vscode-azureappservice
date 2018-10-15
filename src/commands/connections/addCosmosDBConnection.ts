/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AppSettingsTreeItem } from 'vscode-azureappservice';
import * as constants from '../../constants';
import { CosmosDBDatabase } from '../../explorer/CosmosDBDatabase';
import { CosmosDBTreeItem } from '../../explorer/CosmosDBTreeItem';
import { ext } from '../../extensionVariables';
import { IConnections } from './IConnections';

export async function addCosmosDBConnection(node: CosmosDBTreeItem): Promise<void> {
    const connectionToAdd = <string>await vscode.commands.executeCommand('cosmosDB.api.getDatabase');
    if (!connectionToAdd) {
        return;
    }

    const workspaceConfig = vscode.workspace.getConfiguration(constants.extensionPrefix);
    const allConnections = workspaceConfig.get<IConnections[]>(constants.configurationSettings.connections, []);
    let connectionsUnit = allConnections.find((x: IConnections) => x.webAppId === node.root.client.id);
    if (!connectionsUnit) {
        connectionsUnit = <IConnections>{};
        allConnections.push(connectionsUnit);
        connectionsUnit.webAppId = node.root.client.id;
    }

    // tslint:disable-next-line:strict-boolean-expressions
    connectionsUnit.cosmosDB = connectionsUnit.cosmosDB || [];
    if (!connectionsUnit.cosmosDB.find((x: string) => x === connectionToAdd)) {
        connectionsUnit.cosmosDB.push(connectionToAdd);
        workspaceConfig.update(constants.configurationSettings.connections, allConnections);

        const appSettingsToUpdate = "MONGO_URL";
        const connectionStringValue = (<string>await vscode.commands.executeCommand('cosmosDB.api.getConnectionString', connectionToAdd));
        const appSettItem = <AppSettingsTreeItem | undefined>await ext.tree.findTreeItem(connectionsUnit.webAppId + String('/application'));
        if (!appSettItem) {
            throw new Error(`Couldn't find the application settings for web app with provided Id: ${connectionsUnit.webAppId}`);
        }
        await appSettItem.editSettingItem(appSettingsToUpdate, appSettingsToUpdate, connectionStringValue);
        await appSettItem.refresh();

        if (node.contextValue === 'AddCosmosDBConnection') {
            // tslint:disable-next-line:no-non-null-assertion
            await node.parent!.refresh();
        } else {
            await node.refresh();
        }

        const ok: vscode.MessageItem = { title: 'Ok' };
        const showDatabase: vscode.MessageItem = { title: 'Show Database' };

        // Don't wait
        vscode.window.showInformationMessage(`Database "${CosmosDBDatabase.getLabel(connectionToAdd)}" connected to Web App "${node.root.client.fullName}". Created "${appSettingsToUpdate}" App Setting.`, ok, showDatabase).then(async (result: vscode.MessageItem | undefined) => {
            if (result === showDatabase) {
                vscode.commands.executeCommand('cosmosDB.api.revealTreeItem', connectionToAdd);
            }
        });
    }
}

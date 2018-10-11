/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ISiteTreeRoot } from 'vscode-azureappservice';
import { AzureParentTreeItem, AzureTreeItem } from 'vscode-azureextensionui';
import * as constants from '../constants';
import { IConnections } from '../utils/IConnections';

export class CosmosDBDatabase extends AzureTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'cosmosDBDatabase';
    public readonly contextValue: string = CosmosDBDatabase.contextValue;
    public readonly label: string;

    constructor(parent: AzureParentTreeItem, readonly connectionId: string) {
        super(parent);
        this.label = this.getLabel(connectionId);
    }

    public async deleteTreeItem(): Promise<void> {
        const connectionToDelete = this.connectionId;
        const workspaceConfig = vscode.workspace.getConfiguration(constants.extensionPrefix);
        const connections = workspaceConfig.get<IConnections[]>(constants.configurationSettings.connections, []);

        const connectionsUnit = connections.find((x: IConnections) => x.webAppId === this.root.client.id);
        if (connectionsUnit && connectionsUnit.cosmosDB) {
            const indexToDelete = connectionsUnit.cosmosDB.findIndex((x: string) => x === connectionToDelete);
            if (indexToDelete > -1) {
                connectionsUnit.cosmosDB.splice(indexToDelete, 1);
                workspaceConfig.update(constants.configurationSettings.connections, connections);
                // tslint:disable-next-line:no-non-null-assertion
                await this.parent!.refresh();
            }
        }
    }

    private getLabel(id: string): string {
        const items = this.parseCosmos(id) || this.parseAttached(id);
        if (!items) {
            throw new Error('Failed to parse connection id');
        }
        return items[items.length - 1];
    }

    private parseCosmos(id: string): RegExpMatchArray | undefined {
        const matches: RegExpMatchArray | null = id.match('subscriptions\/(.*)resourceGroups\/(.*)providers\/(.*)databaseAccounts\/(.*)');
        if (matches === null || matches.length !== 5) {
            return undefined;
        }
        return matches;
    }

    private parseAttached(id: string): RegExpMatchArray | undefined {
        const matches: RegExpMatchArray | null = id.match('cosmosDBAttachedAccounts\/(.*)');
        if (matches === null || matches.length !== 2) {
            return undefined;
        }
        return matches;
    }
}

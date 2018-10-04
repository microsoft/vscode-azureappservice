/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { SiteClient } from 'vscode-azureappservice';
import { IAzureTreeItem } from 'vscode-azureextensionui';
import * as constants from './../constants';

export class CosmosDBDatabase implements IAzureTreeItem {
    public static contextValue: string = 'cosmosDBDatabase';
    public readonly contextValue: string = CosmosDBDatabase.contextValue;
    public readonly label: string;

    constructor(readonly client: SiteClient, readonly connectionId: string) {
        this.label = this.getLabel(connectionId);
    }

    public async deleteTreeItem(): Promise<void> {
        const workspaceConfig = vscode.workspace.getConfiguration(constants.extensionPrefix);
        const connections = workspaceConfig.get<IConnection[]>(constants.configurationSettings.connections, []);
        const indexToDelete = connections.findIndex((x: IConnection) => x.webAppId === this.client.id);
        if (indexToDelete > -1) {
            connections.splice(indexToDelete, 1);
            workspaceConfig.update(constants.configurationSettings.connections, connections);
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

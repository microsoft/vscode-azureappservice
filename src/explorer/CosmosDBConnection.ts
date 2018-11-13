/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { ISiteTreeRoot } from 'vscode-azureappservice';
import { AzureTreeItem, DialogResponses, UserCancelledError } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { DatabaseTreeItem } from '../vscode-cosmos.api';
import { CosmosDBTreeItem } from './CosmosDBTreeItem';

export class CosmosDBConnection extends AzureTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'cosmosDBConnection';
    public readonly contextValue: string = CosmosDBConnection.contextValue;
    public readonly label: string;
    public readonly parent: CosmosDBTreeItem;

    constructor(parent: CosmosDBTreeItem, readonly databaseTreeItem: DatabaseTreeItem, readonly appSettingKey: string) {
        super(parent);
        this.label = CosmosDBConnection.makeLabel(databaseTreeItem);
    }

    public static makeLabel(databaseTreeItem: DatabaseTreeItem): string {
        return `${databaseTreeItem.azureData ? databaseTreeItem.azureData.accountName : `${databaseTreeItem.hostName}:${databaseTreeItem.port}`}/${databaseTreeItem.databaseName}`;
    }

    public get iconPath(): string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'Database.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'Database.svg')
        };
    }

    public async deleteTreeItemImpl(): Promise<void> {
        const valueToDelete = this.databaseTreeItem.connectionString;

        const appSettings = await this.root.client.listApplicationSettings();
        const properties = appSettings.properties;
        if (properties) {
            const keysToDelete: string[] = [];
            Object.keys(properties).forEach((key) => {
                if (properties[key] === valueToDelete) {
                    keysToDelete.push(key);
                }
            });

            if (keysToDelete.length > 0) {
                const warning: string = `Are you sure you want to remove connection "${this.label}"? This will delete the following application settings: ${keysToDelete.map((s) => `"${s}"`).join(', ')}.`;
                const items: vscode.MessageItem[] = [DialogResponses.deleteResponse, DialogResponses.cancel];
                const result: vscode.MessageItem = await ext.ui.showWarningMessage(warning, { modal: true }, ...items);
                if (result === DialogResponses.cancel) {
                    throw new UserCancelledError();
                }
            }
            keysToDelete.forEach((key) => {
                delete properties[key];
            });
            await this.root.client.updateApplicationSettings(appSettings);
            await this.parent.parent.parent.appSettingsNode.refresh();
        }
    }
}

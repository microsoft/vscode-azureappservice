/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { ISiteTreeRoot } from 'vscode-azureappservice';
import { AzureTreeItem, DialogResponses, UserCancelledError } from 'vscode-azureextensionui';
import { resourcesPath } from '../constants';
import { ext } from '../extensionVariables';
import { DatabaseAccountTreeItem, DatabaseTreeItem } from '../vscode-cosmos.api';
import { CosmosDBTreeItem } from './CosmosDBTreeItem';

export class CosmosDBConnection extends AzureTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'cosmosDBConnection';
    public readonly contextValue: string = CosmosDBConnection.contextValue;
    public readonly label: string;
    public readonly parent: CosmosDBTreeItem;

    constructor(parent: CosmosDBTreeItem, readonly cosmosExtensionItem: DatabaseAccountTreeItem | DatabaseTreeItem, readonly appSettingKeys: string[]) {
        super(parent);
        this.label = CosmosDBConnection.makeLabel(cosmosExtensionItem);
    }

    public get id(): string {
        // App setting keys have to be unique within a web app, so use that for the id. (As opposed to app setting values, which do not have to be unique)
        return this.appSettingKeys[0];
    }

    public static makeLabel(cosmosExtensionItem: DatabaseAccountTreeItem | DatabaseTreeItem): string {
        let label: string;
        if (cosmosExtensionItem.azureData) {
            label = cosmosExtensionItem.azureData.accountName;
        } else {
            label = `${cosmosExtensionItem.hostName}:${cosmosExtensionItem.port}`;
        }

        const dbName: string | undefined = (<DatabaseTreeItem>cosmosExtensionItem).databaseName;
        if (dbName) {
            label += `/${dbName}`;
        }

        return label;
    }

    public get iconPath(): string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } {
        return {
            light: path.join(resourcesPath, 'light', 'Database.svg'),
            dark: path.join(resourcesPath, 'dark', 'Database.svg')
        };
    }

    public async deleteTreeItemImpl(): Promise<void> {
        const appSettings = await this.root.client.listApplicationSettings();
        const properties = appSettings.properties;
        if (properties) {
            const warning: string = `Are you sure you want to remove connection "${this.label}"? This will delete the following application settings: ${this.appSettingKeys.map((s) => `"${s}"`).join(', ')}.`;
            const items: vscode.MessageItem[] = [DialogResponses.deleteResponse, DialogResponses.cancel];
            const result: vscode.MessageItem = await ext.ui.showWarningMessage(warning, { modal: true }, ...items);
            if (result === DialogResponses.cancel) {
                throw new UserCancelledError();
            }
            this.appSettingKeys.forEach((key) => {
                delete properties[key];
            });
            await this.root.client.updateApplicationSettings(appSettings);
            await this.parent.parent.parent.appSettingsNode.refresh();
        }
    }
}

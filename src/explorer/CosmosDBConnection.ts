/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ISiteTreeRoot } from 'vscode-azureappservice';
import { AzureTreeItem, DialogResponses } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { getThemedIconPath, IThemedIconPath } from '../utils/pathUtils';
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

    public get iconPath(): IThemedIconPath {
        return getThemedIconPath('Database');
    }

    public async deleteTreeItemImpl(): Promise<void> {
        const appSettings = await this.root.client.listApplicationSettings();
        const properties = appSettings.properties;
        if (properties) {
            const warning: string = `Are you sure you want to remove connection "${this.label}"? This will delete the following application settings: ${this.appSettingKeys.map((s) => `"${s}"`).join(', ')}.`;
            await ext.ui.showWarningMessage(warning, { modal: true }, DialogResponses.deleteResponse);
            this.appSettingKeys.forEach((key) => {
                delete properties[key];
            });
            await this.root.client.updateApplicationSettings(appSettings);
            await this.parent.parent.parent.appSettingsNode.refresh();
        }
    }
}

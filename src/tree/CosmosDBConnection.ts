/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type StringDictionary } from '@azure/arm-appservice';
import { type IAppSettingsClient } from '@microsoft/vscode-azext-azureappsettings';
import { AzExtTreeItem, DialogResponses, type IActionContext, type TreeItemIconPath } from '@microsoft/vscode-azext-utils';
import { ThemeIcon } from 'vscode';
import { localize } from '../localize';
import { type DatabaseAccountTreeItem, type DatabaseTreeItem } from '../vscode-cosmos.api';
import { type CosmosDBTreeItem } from './CosmosDBTreeItem';

export class CosmosDBConnection extends AzExtTreeItem {
    public static contextValue: string = 'cosmosDBConnection';
    public readonly contextValue: string = CosmosDBConnection.contextValue;
    public readonly label: string;
    public readonly parent!: CosmosDBTreeItem;

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

    public get iconPath(): TreeItemIconPath {
        return new ThemeIcon('database');
    }

    public async deleteTreeItemImpl(context: IActionContext): Promise<void> {
        const appSettingsClient: IAppSettingsClient = await this.parent.site.createClient(context);
        const appSettings: StringDictionary = await appSettingsClient.listApplicationSettings();
        if (appSettings.properties) {
            const warning: string = localize(
                'removeConnection', 'Are you sure you want to remove connection "{0}"? This will delete the following application settings: {1}',
                this.label, this.appSettingKeys.map((s) => `"${s}"`).join(', '));

            await context.ui.showWarningMessage(warning, { modal: true, stepName: 'removeConnection' }, DialogResponses.deleteResponse);
            for (const key of this.appSettingKeys) {
                delete appSettings.properties[key];
            }
            await appSettingsClient.updateApplicationSettings(appSettings);
            await this.parent.parent.appSettingsNode.refresh(context);
        }
    }
}

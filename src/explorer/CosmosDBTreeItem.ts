/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { PickTreeItemOptions } from 'src/vscode-cosmos.api';
import * as vscode from 'vscode';
import { ISiteTreeRoot, validateAppSettingKey } from 'vscode-azureappservice';
import { AzureParentTreeItem, AzureTreeItem, createTreeItemsWithErrorHandling, GenericTreeItem, UserCancelledError } from 'vscode-azureextensionui';
import { AzureExtensionApiProvider } from 'vscode-azureextensionui/api';
import { ext } from '../extensionVariables';
import { ConnectionsTreeItem } from './ConnectionsTreeItem';
import { CosmosDBConnection } from './CosmosDBConnection';

export class CosmosDBTreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'сosmosDBConnections';
    public readonly contextValue: string = CosmosDBTreeItem.contextValue;
    public readonly label: string = 'Cosmos DB';
    public readonly parent: ConnectionsTreeItem;

    constructor(parent: ConnectionsTreeItem) {
        super(parent);
    }

    public get iconPath(): string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'CosmosDBAccount.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'CosmosDBAccount.svg')
        };
    }

    public async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzureTreeItem<ISiteTreeRoot>[]> {
        const cosmosDB = vscode.extensions.getExtension('ms-azuretools.vscode-cosmosdb');
        if (!cosmosDB) {
            return [new GenericTreeItem(this, {
                commandId: 'appService.InstallCosmosDBExtension',
                contextValue: 'InstallCosmosDBExtension',
                label: 'Install Cosmos DB Extension...'
            })];
        }

        if (ext.cosmosAPI === undefined) {
            ext.cosmosAPI = (<AzureExtensionApiProvider>cosmosDB.exports).getApi('^1.0.0');
        }

        const mongoAppSettingsKeys: string[] = [];
        // tslint:disable-next-line:strict-boolean-expressions
        const appSettings = (await this.root.client.listApplicationSettings()).properties || {};
        Object.keys(appSettings).forEach((key) => {
            if (/^mongodb[^:]*:\/\//i.test(appSettings[key])) {
                mongoAppSettingsKeys.push(key);
            }
        });

        const usedLabels: { [key: string]: boolean } = {};
        const treeItems = await createTreeItemsWithErrorHandling(
            this,
            mongoAppSettingsKeys,
            'invalidCosmosDBConnection',
            async (key: string) => {
                const databaseTreeItem = await ext.cosmosAPI.findTreeItem({ connectionString: appSettings[key] });
                if (databaseTreeItem) {
                    const label = CosmosDBConnection.makeLabel(databaseTreeItem);
                    if (!usedLabels[label]) {
                        return new CosmosDBConnection(this, databaseTreeItem, key);
                    }
                }
                return undefined;
            },
            (key: string) => {
                return `Can't create connection for "${key}" application setting`;
            }
        );

        if (treeItems.length > 0) {
            return treeItems;
        }

        return [new GenericTreeItem(this, {
            commandId: 'appService.AddCosmosDBConnection',
            contextValue: 'AddCosmosDBConnection',
            label: 'Add Cosmos DB Connection...'
        })];
    }

    public async createChildImpl(showCreatingTreeItem: (label: string) => void): Promise<AzureTreeItem<ISiteTreeRoot>> {
        const options: PickTreeItemOptions & { resourceType: 'Database' } = {
            resourceType: 'Database',
            apiType: ['Mongo']
        };
        const databaseToAdd = await ext.cosmosAPI.pickTreeItem(options);
        if (!databaseToAdd) {
            throw new UserCancelledError();
        }
        const appSettings = await this.root.client.listApplicationSettings();
        const appSettingKeyToAdd: string = await ext.ui.showInputBox({
            prompt: 'Enter new connection setting key',
            validateInput: (v?: string): string | undefined => validateAppSettingKey(appSettings, v),
            value: "MONGO_URL"
        });
        // tslint:disable-next-line:strict-boolean-expressions
        appSettings.properties = appSettings.properties || {};
        appSettings.properties[appSettingKeyToAdd] = databaseToAdd.connectionString;
        await this.root.client.updateApplicationSettings(appSettings);
        await this.parent.parent.appSettingsNode.refresh();

        const createdDatabase = new CosmosDBConnection(this, databaseToAdd, appSettingKeyToAdd);
        showCreatingTreeItem(createdDatabase.label);

        const ok: vscode.MessageItem = { title: 'OK' };
        const revealDatabase: vscode.MessageItem = { title: 'Reveal Database' };
        // Don't wait
        vscode.window.showInformationMessage(`Database "${createdDatabase.label}" connected to web app "${this.root.client.fullName}". Created "${appSettingKeyToAdd}" application settings.`, ok, revealDatabase).then(async (result: vscode.MessageItem | undefined) => {
            if (result === revealDatabase) {
                await createdDatabase.databaseTreeItem.reveal();
            }
        });

        return createdDatabase;
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }
}

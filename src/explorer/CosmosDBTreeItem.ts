/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { VSCodeCosmosDB } from 'src/vscode-cosmos.api';
import * as vscode from 'vscode';
import { ISiteTreeRoot, validateAppSettingKey } from 'vscode-azureappservice';
import { AzureParentTreeItem, AzureTreeItem, GenericTreeItem, UserCancelledError } from 'vscode-azureextensionui';
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
            ext.cosmosAPI = <VSCodeCosmosDB>cosmosDB.exports;
        }

        const mongoAppSettingsKeys: string[] = [];
        // tslint:disable-next-line:strict-boolean-expressions
        const appSettings = (await this.root.client.listApplicationSettings()).properties || {};
        Object.keys(appSettings).forEach((key) => {
            if (/^mongodb[^:]*:\/\//i.test(appSettings[key])) {
                mongoAppSettingsKeys.push(key);
            }
        });

        const treeItems: CosmosDBConnection[] = [];
        for (const key of mongoAppSettingsKeys) {
            const cosmosDBDatabase = await ext.cosmosAPI.getDatabase({ connectionString: appSettings[key] });
            if (cosmosDBDatabase) {
                treeItems.push(new CosmosDBConnection(this, cosmosDBDatabase, key));
            }
        }

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
        const databaseToAdd = await ext.cosmosAPI.pickDatabase();
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
        const showDatabase: vscode.MessageItem = { title: 'Show Database' };
        // Don't wait
        vscode.window.showInformationMessage(`Database "${createdDatabase.label}" connected to web app "${this.root.client.fullName}". Created "${appSettingKeyToAdd}" app settings.`, ok, showDatabase).then(async (result: vscode.MessageItem | undefined) => {
            if (result === showDatabase) {
                // tslint:disable-next-line:no-non-null-assertion
                await ext.cosmosAPI.revealTreeItem(createdDatabase.cosmosDBDatabase.treeItemId!);
            }
        });

        return createdDatabase;
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }
}

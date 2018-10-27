/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { CosmosDBItem, VSCodeCosmosDB } from 'src/vscode-cosmos.api';
import * as vscode from 'vscode';
import { ISiteTreeRoot } from 'vscode-azureappservice';
import { AzureParentTreeItem, AzureTreeItem, GenericTreeItem, UserCancelledError } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { ConnectionsTreeItem } from './ConnectionsTreeItem';
import { CosmosDBDatabase } from './CosmosDBDatabase';

export class CosmosDBTreeItem extends AzureParentTreeItem<ISiteTreeRoot> {

    public get iconPath(): string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'CosmosDBAccount.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'CosmosDBAccount.svg')
        };
    }

    public static contextValue: string = 'сosmosDBConnections';
    private static mongoPref: string = '^mongodb[^\/]*:\/\/';
    private static mongoCredential: string = '(?:[^@]*@)?';
    private static mongoAccount: string = '([^\/]*)';
    private static mongoDatabase: string = '(\/[^\?]*)?';

    public readonly contextValue: string = CosmosDBTreeItem.contextValue;
    public readonly label: string = 'Cosmos DB';
    public readonly parent: ConnectionsTreeItem;

    constructor(parent: ConnectionsTreeItem) {
        super(parent);
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
        const allAppSettings = await this.root.client.listApplicationSettings();
        if (allAppSettings.properties) {
            const dictionary = allAppSettings.properties;
            const objectDictionary = Object.keys(dictionary);
            objectDictionary.forEach((key) => {
                if (this.isMongoConnectionString(dictionary[key])) {
                    mongoAppSettingsKeys.push(key);
                }
            });

            const treeItems: CosmosDBDatabase[] = [];
            for (const key of mongoAppSettingsKeys) {
                const connectionInfo = <CosmosDBItem>{
                    connectionString: dictionary[key]
                };
                const cosmosDBItem = await ext.cosmosAPI.getDatabase(connectionInfo);
                if (cosmosDBItem) {
                    treeItems.push(new CosmosDBDatabase(this, cosmosDBItem, key));
                }
            }

            if (treeItems.length) {
                return treeItems;
            }
        }

        return [new GenericTreeItem(this, {
            commandId: 'appService.AddCosmosDBConnection',
            contextValue: 'AddCosmosDBConnection',
            label: 'Add Cosmos DB Connection...'
        })];
    }

    public async createChildImpl(showCreatingTreeItem: (label: string) => void): Promise<AzureTreeItem<ISiteTreeRoot>> {
        const databaseToAdd = await ext.cosmosAPI.pickDatabase();
        const appSettingToAddKey = 'MONGO_URL';  // On the top picker asks for the name of connection

        if (!databaseToAdd || !databaseToAdd.connectionString) {
            throw new UserCancelledError();
        }

        const connectionStringToAdd = databaseToAdd.connectionString;
        const allAppSettings = await this.root.client.listApplicationSettings();
        if (allAppSettings.properties) {
            const dictionary = allAppSettings.properties;
            const objectDictionary = Object.keys(dictionary);
            const foundConnection = objectDictionary.find(key => {
                if (dictionary[key] === connectionStringToAdd) {
                    return true;
                }
                return false;
            });

            if (foundConnection) {
                throw new Error(`This Connection is already attached with "${objectDictionary[foundConnection]}" App Settings Name.`);
            }
        }

        const createdDatabase = new CosmosDBDatabase(this, databaseToAdd, appSettingToAddKey);

        const appSettingsNode = this.parent.parent.appSettingsNode;
        await appSettingsNode.editSettingItem(appSettingToAddKey, appSettingToAddKey, connectionStringToAdd);
        await appSettingsNode.refresh();
        showCreatingTreeItem(createdDatabase.label);

        const allAppSettingsToAddKeys: string[] = [appSettingToAddKey];
        const ok: vscode.MessageItem = { title: 'OK' };
        const showDatabase: vscode.MessageItem = { title: 'Show Database' };
        // Don't wait
        vscode.window.showInformationMessage(`Database "${createdDatabase.label}" connected to Web App "${this.root.client.fullName}". Created ${allAppSettingsToAddKeys.map((s) => `"${s}"`).join(', ')} App Settings.`, ok, showDatabase).then(async (result: vscode.MessageItem | undefined) => {
            if (result === showDatabase) {
                // tslint:disable-next-line:no-non-null-assertion
                await ext.cosmosAPI.revealTreeItem(createdDatabase.cosmosDBItem.cosmosDBTreeItemId!);
            }
        });

        return createdDatabase;
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    private isMongoConnectionString(id: string): boolean {
        const regExp = new RegExp(CosmosDBTreeItem.mongoPref + CosmosDBTreeItem.mongoCredential + CosmosDBTreeItem.mongoAccount + CosmosDBTreeItem.mongoDatabase);
        const matches: RegExpMatchArray | null = id.match(regExp);
        if (matches === null || matches.length !== 3) {
            return false;
        }
        return true;
    }
}

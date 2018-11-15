/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StringDictionary } from 'azure-arm-website/lib/models';
import * as path from 'path';
import * as vscode from 'vscode';
import { ISiteTreeRoot, validateAppSettingKey } from 'vscode-azureappservice';
import { AzureParentTreeItem, AzureTreeItem, createTreeItemsWithErrorHandling, GenericTreeItem, UserCancelledError } from 'vscode-azureextensionui';
import { AzureExtensionApiProvider } from 'vscode-azureextensionui/api';
import { ext } from '../extensionVariables';
import { DatabaseTreeItem } from '../vscode-cosmos.api';
import { ConnectionsTreeItem } from './ConnectionsTreeItem';
import { CosmosDBConnection } from './CosmosDBConnection';

export class CosmosDBTreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'сosmosDBConnections';
    public readonly contextValue: string = CosmosDBTreeItem.contextValue;
    public readonly label: string = 'Cosmos DB';
    public readonly parent: ConnectionsTreeItem;

    private readonly _endpointSuffix: string = 'ENDPOINT';
    private readonly _keySuffix: string = 'MASTER_KEY';
    private readonly _databaseSuffix: string = 'DATABASE_ID';

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

        // tslint:disable-next-line:strict-boolean-expressions
        const appSettings = (await this.root.client.listApplicationSettings()).properties || {};
        const connections: IDetectedConnection[] = this.detectMongoConnections(appSettings).concat(this.detectDocDBConnections(appSettings));
        const usedLabels: { [key: string]: boolean } = {};
        const treeItems = await createTreeItemsWithErrorHandling(
            this,
            connections,
            'invalidCosmosDBConnection',
            async (c: IDetectedConnection) => {
                const databaseTreeItem = await ext.cosmosAPI.findTreeItem({
                    connectionString: c.connectionString
                });
                if (databaseTreeItem) {
                    const label = CosmosDBConnection.makeLabel(databaseTreeItem);
                    if (!usedLabels[label]) {
                        usedLabels[label] = true;
                        return new CosmosDBConnection(this, databaseTreeItem, c.key);
                    }
                }
                return undefined;
            },
            (c: IDetectedConnection) => c.key
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
        const databaseToAdd = await ext.cosmosAPI.pickTreeItem({
            resourceType: 'Database'
        });
        if (!databaseToAdd) {
            throw new UserCancelledError();
        }
        const appSettings = await this.root.client.listApplicationSettings();
        const newAppSettings: Map<string, string> = databaseToAdd.docDBData ? await this.promptForDocDBAppSettings(appSettings, databaseToAdd) : await this.promptForMongoAppSettings(appSettings, databaseToAdd);

        // tslint:disable-next-line:strict-boolean-expressions
        appSettings.properties = appSettings.properties || {};
        for (const [k, v] of newAppSettings) {
            appSettings.properties[k] = v;
        }

        await this.root.client.updateApplicationSettings(appSettings);
        await this.parent.parent.appSettingsNode.refresh();

        const createdDatabase = new CosmosDBConnection(this, databaseToAdd, newAppSettings.keys()[0]);
        showCreatingTreeItem(createdDatabase.label);

        const ok: vscode.MessageItem = { title: 'OK' };
        const revealDatabase: vscode.MessageItem = { title: 'Reveal Database' };
        const message: string = `Database "${createdDatabase.label}" connected to web app "${this.root.client.fullName}". Created the following application settings: "${Array.from(newAppSettings.keys()).join(', ')}".`;
        // Don't wait
        vscode.window.showInformationMessage(message, ok, revealDatabase).then(async (result: vscode.MessageItem | undefined) => {
            if (result === revealDatabase) {
                await createdDatabase.cosmosExtensionItem.reveal();
            }
        });

        return createdDatabase;
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    private detectMongoConnections(appSettings: StringDictionary): IDetectedConnection[] {
        const result: IDetectedConnection[] = [];
        for (const key of Object.keys(appSettings)) {
            const value = appSettings[key];
            if (/^mongodb[^:]*:\/\//i.test(value)) {
                result.push({
                    key: key,
                    connectionString: appSettings[key]
                });
            }
        }
        return result;
    }

    private detectDocDBConnections(appSettings: StringDictionary): IDetectedConnection[] {
        const result: IDetectedConnection[] = [];
        const regexp = new RegExp(`(.+_)${this._endpointSuffix}`, 'i');
        for (const key of Object.keys(appSettings)) {
            const match = key && key.match(regexp);
            if (match) {
                const prefix = match[1];
                const documentEndpoint: string | undefined = appSettings[prefix + this._endpointSuffix];
                const masterKey: string | undefined = appSettings[prefix + this._keySuffix];
                const databaseName: string | undefined = appSettings[prefix + this._databaseSuffix];

                if (documentEndpoint && masterKey) {
                    result.push({
                        key: key,
                        connectionString: `AccountEndpoint=${documentEndpoint};AccountKey=${masterKey};Database=${databaseName}`
                    });
                }
            }
        }

        return result;
    }

    private async promptForMongoAppSettings(appSettings: StringDictionary, database: DatabaseTreeItem): Promise<Map<string, string>> {
        const prompt: string = 'Enter new connection setting key';
        const defaultKey: string = 'MONGO_URL';

        const appSettingKey: string = await ext.ui.showInputBox({
            prompt,
            validateInput: (v?: string): string | undefined => validateAppSettingKey(appSettings, v),
            value: defaultKey
        });

        return new Map([[appSettingKey, database.connectionString]]);
    }

    private async promptForDocDBAppSettings(appSettings: StringDictionary, database: DatabaseTreeItem): Promise<Map<string, string>> {
        const prompt: string = 'Enter new connection setting prefix';
        const defaultPrefix: string = 'AZURE_COSMOS_';

        const appSettingPrefix: string = await ext.ui.showInputBox({
            prompt,
            validateInput: (v?: string): string | undefined => {
                return validateAppSettingKey(appSettings, v + this._endpointSuffix) || validateAppSettingKey(appSettings, v + this._keySuffix) || validateAppSettingKey(appSettings, v + this._databaseSuffix);
            },
            value: defaultPrefix
        });

        return new Map([
            // tslint:disable-next-line:no-non-null-assertion
            [appSettingPrefix + this._endpointSuffix, database.docDBData!.documentEndpoint],
            // tslint:disable-next-line:no-non-null-assertion
            [appSettingPrefix + this._keySuffix, database.docDBData!.masterKey],
            [appSettingPrefix + this._databaseSuffix, database.databaseName]
        ]);
    }
}

interface IDetectedConnection {
    key: string;
    connectionString: string;
}

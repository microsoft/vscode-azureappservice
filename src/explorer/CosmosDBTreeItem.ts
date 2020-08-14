/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StringDictionary } from 'azure-arm-website/lib/models';
import * as vscode from 'vscode';
import { ISiteTreeRoot, validateAppSettingKey } from 'vscode-azureappservice';
import { AzExtTreeItem, AzureParentTreeItem, GenericTreeItem, ICreateChildImplContext, UserCancelledError } from 'vscode-azureextensionui';
import { AzureExtensionApiProvider } from 'vscode-azureextensionui/api';
import { ext } from '../extensionVariables';
import { nonNullProp } from '../utils/nonNull';
import { getThemedIconPath, IThemedIconPath } from '../utils/pathUtils';
import { CosmosDBExtensionApi, DatabaseTreeItem } from '../vscode-cosmos.api';
import { ConnectionsTreeItem } from './ConnectionsTreeItem';
import { CosmosDBConnection } from './CosmosDBConnection';

export class CosmosDBTreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public static contextValueInstalled: string = 'сosmosDBConnections';
    public static contextValueNotInstalled: string = 'сosmosDBNotInstalled';
    public readonly label: string = 'Azure Databases';
    public readonly childTypeLabel: string = 'Connection';
    public readonly parent: ConnectionsTreeItem;
    public cosmosDBExtension: vscode.Extension<AzureExtensionApiProvider | undefined> | undefined;

    private readonly _endpointSuffix: string = '_ENDPOINT';
    private readonly _keySuffix: string = '_MASTER_KEY';
    private readonly _databaseSuffix: string = '_DATABASE_ID';

    private readonly _hostSuffix: string = '_DBHOST';
    private readonly _dbNameSuffix: string = '_DBNAME';
    private readonly _userSuffix: string = '_DBUSER';
    private readonly _passSuffix: string = '_DBPASS';

    private _cosmosDBApi: CosmosDBExtensionApi | undefined;

    constructor(parent: ConnectionsTreeItem) {
        super(parent);
        this.cosmosDBExtension = vscode.extensions.getExtension('ms-azuretools.vscode-cosmosdb');
    }

    public get contextValue(): string {
        return this.cosmosDBExtension ? CosmosDBTreeItem.contextValueInstalled : CosmosDBTreeItem.contextValueNotInstalled;
    }

    public get iconPath(): IThemedIconPath {
        return getThemedIconPath('AzureDatabases');
    }

    public async refreshImpl(): Promise<void> {
        this.cosmosDBExtension = vscode.extensions.getExtension('ms-azuretools.vscode-cosmosdb');
    }

    public async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzExtTreeItem[]> {
        if (!this.cosmosDBExtension) {
            return [new GenericTreeItem(this, {
                commandId: 'appService.InstallCosmosDBExtension',
                contextValue: 'InstallCosmosDBExtension',
                label: 'Install Azure Databases Extension...'
            })];
        }

        const cosmosDBApi = await this.getCosmosDBApi();
        // tslint:disable-next-line:strict-boolean-expressions
        const appSettings = (await this.parent.client.listApplicationSettings()).properties || {};
        const connections: IDetectedConnection[] = this.detectMongoConnections(appSettings).concat(this.detectDocDBConnections(appSettings)).concat(this.detectPostgresConnections(appSettings));
        // tslint:disable-next-line: no-console
        const treeItems = await this.createTreeItemsWithErrorHandling(
            connections,
            'invalidCosmosDBConnection',
            async (c: IDetectedConnection) => {
                const databaseTreeItem = await cosmosDBApi.findTreeItem({
                    connectionString: c.connectionString
                });
                return databaseTreeItem ? new CosmosDBConnection(this, databaseTreeItem, c.keys) : undefined;
            },
            (c: IDetectedConnection) => c.keys[0] // just use first key for label if connection is invalid
        );

        if (treeItems.length > 0) {
            return treeItems;
        } else {
            return [new GenericTreeItem(this, {
                commandId: 'appService.AddAzureDatabasesConnection',
                contextValue: 'AddAzureDatabasesConnection',
                label: 'Add Azure Databases Connection...'
            })];
        }
    }

    public async createChildImpl(context: ICreateChildImplContext): Promise<AzExtTreeItem> {
        const cosmosDBApi = await this.getCosmosDBApi();
        const databaseToAdd = await cosmosDBApi.pickTreeItem({
            resourceType: 'Database'
        });
        if (!databaseToAdd) {
            throw new UserCancelledError();
        }
        const appSettingsDict = await this.parent.client.listApplicationSettings();
        // tslint:disable-next-line:strict-boolean-expressions
        appSettingsDict.properties = appSettingsDict.properties || {};

        let newAppSettings: Map<string, string>;
        if (databaseToAdd.docDBData) {
            newAppSettings = await this.promptForDocDBAppSettings(appSettingsDict, databaseToAdd);
        } else if (databaseToAdd.postgresData) {
            newAppSettings = await this.promptForPostgresAppSettings(appSettingsDict, databaseToAdd);
        } else {
            newAppSettings = await this.promptForMongoAppSettings(appSettingsDict, databaseToAdd);
        }

        for (const [k, v] of newAppSettings) {
            appSettingsDict.properties[k] = v;
        }

        await this.parent.client.updateApplicationSettings(appSettingsDict);
        await this.parent.parent.appSettingsNode.refresh();

        const createdDatabase = new CosmosDBConnection(this, databaseToAdd, Array.from(newAppSettings.keys()));
        context.showCreatingTreeItem(createdDatabase.label);

        const ok: vscode.MessageItem = { title: 'OK' };
        const revealDatabase: vscode.MessageItem = { title: 'Reveal Database' };
        const message: string = `Database "${createdDatabase.label}" connected to web app "${this.parent.client.fullName}". Created the following application settings: "${Array.from(newAppSettings.keys()).join(', ')}".`;
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

    private async getCosmosDBApi(): Promise<CosmosDBExtensionApi> {
        if (this._cosmosDBApi) {
            return this._cosmosDBApi;
        } else if (this.cosmosDBExtension) {
            if (!this.cosmosDBExtension.isActive) {
                await this.cosmosDBExtension.activate();
            }

            // The Cosmos DB extension just recently added support for 'AzureExtensionApiProvider' so we should do an additional check just to makes sure it's defined
            if (this.cosmosDBExtension.exports) {
                this._cosmosDBApi = this.cosmosDBExtension.exports.getApi<CosmosDBExtensionApi>('^1.0.0');
                return this._cosmosDBApi;
            }
        }

        throw new Error('You must have the "Azure Databases" extension installed to perform this operation.');
    }

    private detectMongoConnections(appSettings: { [propertyName: string]: string }): IDetectedConnection[] {
        const result: IDetectedConnection[] = [];
        for (const key of Object.keys(appSettings)) {
            const value = appSettings[key];
            if (/^mongodb[^:]*:\/\//i.test(value)) {
                result.push({
                    keys: [key],
                    connectionString: appSettings[key]
                });
            }
        }
        return result;
    }

    private detectPostgresConnections(appSettings: { [propertyName: string]: string }): IDetectedConnection[] {
        const connectionStringPrefix = 'postgres://';
        const connectionStringPort = '5432';

        const result: IDetectedConnection[] = [];
        const regexp = new RegExp(`(.+)${this._hostSuffix}`, 'i');
        for (const key of Object.keys(appSettings)) {
            const match = key && key.match(regexp);
            if (match) {
                const prefix = match[1];
                const hostKey = prefix + this._hostSuffix;
                const dbNameKey = prefix + this._dbNameSuffix;
                const userKey = prefix + this._userSuffix;
                const passKey = prefix + this._passSuffix;
                const host: string | undefined = appSettings[hostKey];
                const dbName: string | undefined = appSettings[dbNameKey];
                const username: string | undefined = appSettings[userKey];
                const password: string | undefined = appSettings[passKey];

                if (host && username && password) {
                    const keys: string[] = [hostKey, userKey, passKey];
                    let connectionString: string = `${connectionStringPrefix}${username}:${password}@${host}:${connectionStringPort}`;
                    if (dbNameKey) {
                        keys.push(dbNameKey);
                        connectionString += `/${dbName}`;
                    }
                    result.push({ keys, connectionString });
                } else if (host) {
                    const keys: string[] = [hostKey];
                    let connectionString: string = `${connectionStringPrefix}${host}:${connectionStringPort}`;
                    if (dbNameKey) {
                        keys.push(dbNameKey);
                        connectionString += `/${dbName}`;
                    }
                    result.push({ keys, connectionString });
                }
            }
        }
        return result;
    }

    private detectDocDBConnections(appSettings: { [propertyName: string]: string }): IDetectedConnection[] {
        const connectionStringEndpointPrefix = 'AccountEndpoint=';
        const connectionStringKeyPrefix = 'AccountKey=';
        const result: IDetectedConnection[] = [];
        const regexp = new RegExp(`(.+)${this._endpointSuffix}`, 'i');
        for (const key of Object.keys(appSettings)) {
            // First, check for connection string split up into multiple app settings (endpoint, key, and optional database id)
            const match = key && key.match(regexp);
            if (match) {
                const prefix = match[1];
                const endpointKey = prefix + this._endpointSuffix;
                const keyKey = prefix + this._keySuffix;
                const documentEndpoint: string | undefined = appSettings[endpointKey];
                const masterKey: string | undefined = appSettings[keyKey];

                if (documentEndpoint && masterKey) {
                    const keys: string[] = [endpointKey, keyKey];
                    let connectionString = `${connectionStringEndpointPrefix}${documentEndpoint};${connectionStringKeyPrefix}${masterKey};`;

                    const databaseKey = prefix + this._databaseSuffix;
                    if (Object.keys(appSettings).find((k) => k === databaseKey)) {
                        keys.push(databaseKey);
                        connectionString += `Database=${appSettings[databaseKey]}`;
                    }

                    result.push({ keys, connectionString });
                }
            } else {
                // Second, check for connection string as one app setting
                const regExp1 = new RegExp(connectionStringEndpointPrefix, 'i');
                const regExp2 = new RegExp(connectionStringKeyPrefix, 'i');

                const value: string = appSettings[key];
                if (regExp1.test(value) && regExp2.test(value)) {
                    result.push({ keys: [key], connectionString: value });
                }
            }
        }

        return result;
    }

    private async promptForMongoAppSettings(appSettingsDict: StringDictionary, database: DatabaseTreeItem): Promise<Map<string, string>> {
        const prompt: string = 'Enter new connection setting key';
        const defaultKey: string = 'MONGO_URL';

        const appSettingKey: string = await ext.ui.showInputBox({
            prompt,
            validateInput: (v: string): string | undefined => validateAppSettingKey(appSettingsDict, this.parent.client, v),
            value: defaultKey
        });

        return new Map([[appSettingKey, database.connectionString]]);
    }

    private async promptForPostgresAppSettings(appSettingsDict: StringDictionary, database: DatabaseTreeItem): Promise<Map<string, string>> {
        const prompt: string = 'Enter new connection setting prefix';
        const defaultPrefix: string = 'POSTGRES';

        const appSettingPrefix: string = await ext.ui.showInputBox({
            prompt,
            validateInput: (v: string): string | undefined => {
                if (!v) {
                    return "Connection setting prefix cannot be empty.";
                } else {
                    return validateAppSettingKey(appSettingsDict, this.parent.client, v + this._hostSuffix) || validateAppSettingKey(appSettingsDict, this.parent.client, v + this._dbNameSuffix) || validateAppSettingKey(appSettingsDict, this.parent.client, v + this._userSuffix) || validateAppSettingKey(appSettingsDict, this.parent.client, v + this._passSuffix);
                }
            },
            value: defaultPrefix
        });

        return new Map([
            [appSettingPrefix + this._hostSuffix, database.hostName],
            [appSettingPrefix + this._dbNameSuffix, database.databaseName],
            [appSettingPrefix + this._userSuffix, nonNullProp(database, 'postgresData').username],
            [appSettingPrefix + this._passSuffix, nonNullProp(database, 'postgresData').password]
        ]);
    }

    private async promptForDocDBAppSettings(appSettingsDict: StringDictionary, database: DatabaseTreeItem): Promise<Map<string, string>> {
        const prompt: string = 'Enter new connection setting prefix';
        const defaultPrefix: string = 'AZURE_COSMOS';

        const appSettingPrefix: string = await ext.ui.showInputBox({
            prompt,
            validateInput: (v?: string): string | undefined => {
                if (!v) {
                    return "Connection setting prefix cannot be empty.";
                } else {
                    return validateAppSettingKey(appSettingsDict, this.parent.client, v + this._endpointSuffix) || validateAppSettingKey(appSettingsDict, this.parent.client, v + this._keySuffix) || validateAppSettingKey(appSettingsDict, this.parent.client, v + this._databaseSuffix);
                }
            },
            value: defaultPrefix
        });

        return new Map([
            [appSettingPrefix + this._endpointSuffix, nonNullProp(database, 'docDBData').documentEndpoint],
            [appSettingPrefix + this._keySuffix, nonNullProp(database, 'docDBData').masterKey],
            [appSettingPrefix + this._databaseSuffix, database.databaseName]
        ]);
    }
}

interface IDetectedConnection {
    keys: string[];
    connectionString: string;
}

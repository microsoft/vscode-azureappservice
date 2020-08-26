/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StringDictionary } from 'azure-arm-website/lib/models';
import * as vscode from 'vscode';
import { IAppSettingsClient, ISiteTreeRoot, validateAppSettingKey } from 'vscode-azureappservice';
import { AzExtTreeItem, AzureParentTreeItem, GenericTreeItem, ICreateChildImplContext, UserCancelledError } from 'vscode-azureextensionui';
import { AzureExtensionApiProvider } from 'vscode-azureextensionui/api';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { nonNullProp } from '../utils/nonNull';
import { getThemedIconPath, IThemedIconPath } from '../utils/pathUtils';
import { CosmosDBExtensionApi, DatabaseTreeItem } from '../vscode-cosmos.api';
import { CosmosDBConnection } from './CosmosDBConnection';
import { SiteTreeItem } from './SiteTreeItem';

export class CosmosDBTreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public static contextValueInstalled: string = 'сosmosDBConnections';
    public static contextValueNotInstalled: string = 'сosmosDBNotInstalled';
    public readonly label: string = 'Databases';
    public readonly childTypeLabel: string = 'Connection';
    public readonly parent: SiteTreeItem;
    public readonly client: IAppSettingsClient;
    public cosmosDBExtension: vscode.Extension<AzureExtensionApiProvider | undefined> | undefined;

    private readonly _endpointSuffix: string = '_ENDPOINT';
    private readonly _keySuffix: string = '_MASTER_KEY';
    private readonly _databaseSuffix: string = '_DATABASE_ID';

    private readonly _pgHostSuffix: string = '_DBHOST';
    private readonly _pgDbNameSuffix: string = '_DBNAME';
    private readonly _pgUserSuffix: string = '_DBUSER';
    private readonly _pgPassSuffix: string = '_DBPASS';
    private readonly _pgPortSuffix: string = '_DBPORT';

    private _cosmosDBApi: CosmosDBExtensionApi | undefined;

    constructor(parent: SiteTreeItem, client: IAppSettingsClient) {
        super(parent);
        this.client = client;
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
        const connections: IDetectedConnection[] = this.detectConnections(appSettings);

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
            newAppSettings = await this.promptForAppSettings(appSettingsDict, databaseToAdd, 'AZURE_COSMOS');
        } else if (databaseToAdd.connectionString.startsWith('postgres://')) {
            newAppSettings = await this.promptForAppSettings(appSettingsDict, databaseToAdd, 'POSTGRES');
        } else {
            newAppSettings = await this.promptForAppSettings(appSettingsDict, databaseToAdd, 'MONGO_URL');
        }

        for (const [k, v] of newAppSettings) {
            appSettingsDict.properties[k] = v;
        }

        await this.parent.client.updateApplicationSettings(appSettingsDict);
        await this.parent.appSettingsNode.refresh();

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

    private detectConnections(appSettings: { [propertyName: string]: string }): IDetectedConnection[] {
        const resultList: IDetectedConnection[] = [];
        let result: IDetectedConnection | undefined;
        for (const key of Object.keys(appSettings)) {
            result = this.detectMongoConnections(appSettings, key);
            if (result) {
                resultList.push(result);
                continue;
            }
            result = this.detectPostgresConnections(appSettings, key);
            if (result) {
                resultList.push(result);
                continue;
            }
            result = this.detectDocDBConnections(appSettings, key);
            if (result) {
                resultList.push(result);
                continue;
            }
        }
        return resultList;
    }

    private detectMongoConnections(appSettings: { [propertyName: string]: string }, key: string): IDetectedConnection | undefined {
        const value = appSettings[key];
        if (/^mongodb[^:]*:\/\//i.test(value)) {
            return { keys: [key], connectionString: appSettings[key] };
        }
        return undefined;
    }

    private detectPostgresConnections(appSettings: { [propertyName: string]: string }, key: string): IDetectedConnection | undefined {
        const connectionStringPrefix = 'postgres://';
        const portDefault = '5432';

        const regexp = new RegExp(`(.+)${this._pgHostSuffix}`, 'i');

        const match = key && key.match(regexp);
        if (match) {
            const prefix = match[1];
            const hostKey = prefix + this._pgHostSuffix;
            const dbNameKey = prefix + this._pgDbNameSuffix;
            const userKey = prefix + this._pgUserSuffix;
            const passKey = prefix + this._pgPassSuffix;
            const portKey = prefix + this._pgPortSuffix;

            if (appSettings[hostKey]) {
                const keys: string[] = [hostKey, portKey];
                let connectionString: string = connectionStringPrefix;
                if (appSettings[userKey]) {
                    if (appSettings[passKey]) {
                        connectionString += `${encodeURIComponent(appSettings[userKey])}:${encodeURIComponent(appSettings[passKey])}@`;
                        keys.push(userKey, passKey);
                    } else {
                        connectionString += `${encodeURIComponent(appSettings[userKey])}@`;
                        keys.push(userKey);
                    }
                }
                connectionString += `${appSettings[hostKey]}:${appSettings[portKey] ? appSettings[portKey] : portDefault}`;
                if (appSettings[dbNameKey]) {
                    connectionString += `/${encodeURIComponent(appSettings[dbNameKey])}`;
                    keys.push(dbNameKey);
                }
                return { keys, connectionString };
            }
        }
        return undefined;
    }

    private detectDocDBConnections(appSettings: { [propertyName: string]: string }, key: string): IDetectedConnection | undefined {
        const connectionStringEndpointPrefix = 'AccountEndpoint=';
        const connectionStringKeyPrefix = 'AccountKey=';
        const regexp = new RegExp(`(.+)${this._endpointSuffix}`, 'i');

        // First, check for connection string split up into multiple app settings (endpoint, key, and optional database id)
        const match = key && key.match(regexp);
        if (match) {
            const prefix = match[1];
            const endpointKey = prefix + this._endpointSuffix;
            const keyKey = prefix + this._keySuffix;

            if (appSettings[endpointKey] && appSettings[keyKey]) {
                const keys: string[] = [endpointKey, keyKey];
                let connectionString = `${connectionStringEndpointPrefix}${appSettings[endpointKey]};${connectionStringKeyPrefix}${appSettings[keyKey]};`;

                const databaseKey = prefix + this._databaseSuffix;
                if (Object.keys(appSettings).find((k) => k === databaseKey)) {
                    keys.push(databaseKey);
                    connectionString += `Database=${appSettings[databaseKey]}`;
                }

                return { keys, connectionString };
            }
        } else {
            // Second, check for connection string as one app setting
            const regExp1 = new RegExp(connectionStringEndpointPrefix, 'i');
            const regExp2 = new RegExp(connectionStringKeyPrefix, 'i');

            const value: string = appSettings[key];
            if (regExp1.test(value) && regExp2.test(value)) {
                return { keys: [key], connectionString: value };
            }
        }

        return undefined;
    }

    private async promptForAppSettings(appSettingsDict: StringDictionary, database: DatabaseTreeItem, defaultPrefix: string): Promise<Map<string, string>> {
        const prompt: string = 'Enter new connection setting key';
        const postgresSuffixes = [this._pgHostSuffix, this._pgDbNameSuffix, this._pgUserSuffix, this._pgPassSuffix, this._pgPortSuffix];
        const docdbSuffixes = [this._endpointSuffix, this._keySuffix, this._databaseSuffix];
        const generalErrorMsg = localize('prefixError', 'Connection setting prefix cannot be empty.');
        const mongoErrorMsg = localize('keyError', 'Connection setting key cannot be empty.');

        const mongoAppSettings = new Map([[undefined, database.connectionString]]);
        const postgresAppSettings = new Map([
            [this._pgHostSuffix, database.hostName],
            [this._pgDbNameSuffix, database.databaseName],
            [this._pgUserSuffix, database.postgresData?.username],
            [this._pgPassSuffix, database.postgresData?.password],
            [this._pgPortSuffix, database.port]
        ]);
        const docdbAppSettings = new Map([
            [this._endpointSuffix, nonNullProp(database, 'docDBData').documentEndpoint],
            [this._keySuffix, nonNullProp(database, 'docDBData').masterKey],
            [this._databaseSuffix, database.databaseName]
        ]);

        let suffixes: string[] | undefined;
        let errorMsg: string;
        let appSettings: Map<String | undefined, String | undefined>;
        switch (defaultPrefix) {
            case 'POSTGRES':
                suffixes = postgresSuffixes;
                errorMsg = generalErrorMsg;
                appSettings = postgresAppSettings;
            case 'AZURE_COSMOS':
                suffixes = docdbSuffixes;
                errorMsg = generalErrorMsg;
                appSettings = docdbAppSettings;
            default:
                suffixes = undefined;
                errorMsg = mongoErrorMsg;
                appSettings = mongoAppSettings;
        }

        const appSettingsPrefix: string = await ext.ui.showInputBox({
            prompt,
            validateInput: (v: string): string | undefined => {
                if (!v) {
                    return errorMsg;
                } else {
                    return this.validateAppSettingPrefix(v, appSettingsDict, suffixes);
                }
            },
            value: defaultPrefix
        });

        return this.getAppSettings(appSettings, appSettingsPrefix);

    }

    private async getAppSettings(appSettings: Map<String | undefined, String | undefined>, appSettingsPrefix: string): Promise<Map<string, string>> {
        const result: Map<string, string> = new Map();
        appSettings.forEach((value: string | undefined, key: string | undefined) => {
            if (key && value) {
                result.set(appSettingsPrefix + key, value);
            } else if (value) {
                result.set(appSettingsPrefix, value);
            }
        });
        return result;
    }

    private validateAppSettingPrefix(prefix: string, appSettingsDict: StringDictionary, suffixes: string[] | undefined): string | undefined {
        if (suffixes) {
            return suffixes.reduce<string | undefined>((result, suffix) => result || validateAppSettingKey(appSettingsDict, this.parent.client, prefix + suffix), undefined);
        }
        return validateAppSettingKey(appSettingsDict, this.parent.client, prefix);
    }
}

interface IDetectedConnection {
    keys: string[];
    connectionString: string;
}

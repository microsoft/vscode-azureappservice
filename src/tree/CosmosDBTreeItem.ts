/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ParsedSite } from 'vscode-azureappservice';
import { ConnectDatabaseAccountPromptStep, ConnectDatabasePromptStep, DatabaseApiStep, DatabaseConnectionCreateStep, DBTreeItem, IConnectDBWizardContext } from 'vscode-azuredatabases';
import { AzExtParentTreeItem, AzExtTreeItem, AzureWizard, AzureWizardPromptStep, GenericTreeItem, IActionContext, ICreateChildImplContext, LocationListStep, openInPortal, TreeItemIconPath, UserCancelledError } from 'vscode-azureextensionui';
import { AzureExtensionApiProvider } from 'vscode-azureextensionui/api';
import { setDatabasesAppSettings } from '../commands/connections/addCosmosDBConnection';
import { getCosmosDBApi, revealConnection } from '../commands/connections/revealConnection';
import { databaseSuffix, endpointSuffix, keySuffix, pgDbNameSuffix, pgHostSuffix, pgPassSuffix, pgPortSuffix, pgUserSuffix } from '../constants';
import { localize } from '../localize';
import { nonNullProp, nonNullValue } from '../utils/nonNull';
import { getThemedIconPath } from '../utils/pathUtils';
import { AzureDatabasesExtensionApi } from '../vscode-cosmos.api';
import { CosmosDBConnection } from './CosmosDBConnection';
import { SiteTreeItem } from './SiteTreeItem';

export class CosmosDBTreeItem extends AzExtParentTreeItem {
    public static contextValueInstalled: string = 'сosmosDBConnections';
    public static contextValueNotInstalled: string = 'сosmosDBNotInstalled';
    public readonly label: string = 'Databases';
    public readonly childTypeLabel: string = 'Connection';
    public readonly parent!: SiteTreeItem;
    public readonly site: ParsedSite;
    public readonly database: DBTreeItem | undefined;
    public cosmosDBExtension: vscode.Extension<AzureExtensionApiProvider | undefined> | undefined;
    public suppressMaskLabel = true;

    private _cosmosDBApi: AzureDatabasesExtensionApi | undefined;

    constructor(parent: SiteTreeItem, site: ParsedSite) {
        super(parent);
        this.site = site;
        this.cosmosDBExtension = vscode.extensions.getExtension('ms-azuretools.vscode-cosmosdb');
    }

    public get contextValue(): string {
        return this.cosmosDBExtension ? CosmosDBTreeItem.contextValueInstalled : CosmosDBTreeItem.contextValueNotInstalled;
    }

    public get iconPath(): TreeItemIconPath {
        return getThemedIconPath('AzureDatabases');
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async refreshImpl(): Promise<void> {
        this.cosmosDBExtension = vscode.extensions.getExtension('ms-azuretools.vscode-cosmosdb');
    }

    public async loadMoreChildrenImpl(_clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]> {
        if (!this.cosmosDBExtension) {
            return [new GenericTreeItem(this, {
                commandId: 'appService.InstallCosmosDBExtension',
                contextValue: 'InstallCosmosDBExtension',
                label: localize('installDb', 'Install Azure Databases Extension...')
            })];
        }

        const cosmosDBApi = nonNullValue(await getCosmosDBApi());
        const client = await this.parent.site.createClient(context);
        const appSettings = (await client.listApplicationSettings()).properties || {};
        const connections: IDetectedConnection[] = this.detectMongoConnections(appSettings).concat(this.detectDocDBConnections(appSettings)).concat(this.detectPostgresConnections(appSettings));
        const treeItems = await this.createTreeItemsWithErrorHandling(
            connections,
            'invalidCosmosDBConnection',
            async (c: IDetectedConnection) => {
                const databaseTreeItem = await cosmosDBApi.findTreeItem({
                    connectionString: c.connectionString,
                    postgresData: c.postgresData
                });
                const database: DBTreeItem = {
                    azureData: databaseTreeItem?.azureData,
                    postgresData: databaseTreeItem?.postgresData,
                    connectionString: databaseTreeItem?.connectionString,
                    port: databaseTreeItem?.port,
                    hostName: databaseTreeItem?.hostName,
                    docDBData: databaseTreeItem?.docDBData
                };
                return databaseTreeItem ? new CosmosDBConnection(this, database, c.keys) : undefined;
            },
            (c: IDetectedConnection) => c.keys[0] // just use first key for label if connection is invalid
        );

        if (treeItems.length > 0) {
            return treeItems;
        } else {
            return [new GenericTreeItem(this, {
                commandId: 'appService.AddAzureDatabasesConnection',
                contextValue: 'AddAzureDatabasesConnection',
                label: localize('addDbConnection', 'Add Azure Databases Connection...')
            })];
        }
    }

    public async createChildImpl(context: ICreateChildImplContext): Promise<AzExtTreeItem> {

        const wizardContext: IConnectDBWizardContext = Object.assign(context, this.subscription);

        const promptSteps: AzureWizardPromptStep<IConnectDBWizardContext>[] = [
            new DatabaseApiStep(),
            new ConnectDatabaseAccountPromptStep(false, true),
            new ConnectDatabasePromptStep(false)
        ];

        wizardContext.newResourceGroupName = this.site.resourceGroup;
        await LocationListStep.setLocation(wizardContext, this.site.location);
        const wizard = new AzureWizard(wizardContext, {
            promptSteps,
            executeSteps: [new DatabaseConnectionCreateStep()],
            title: localize('createDBConnection', 'Create new Azure Databases Connection')
        });

        await wizard.prompt();
        await wizard.execute();
        const databaseToAdd = nonNullProp(wizardContext, 'databaseConnectionTreeItem');


        const newAppSettings = await setDatabasesAppSettings(context, databaseToAdd, this);

        if (!databaseToAdd) {
            throw new UserCancelledError('cosmosDBpickTreeItem');
        }

        const createdDatabase = new CosmosDBConnection(this, databaseToAdd, Array.from(newAppSettings.keys()));
        context.showCreatingTreeItem(createdDatabase.label);

        const revealDatabase: vscode.MessageItem = { title: localize('reveal', 'Reveal Database') };
        const manageFirewallRules: vscode.MessageItem = { title: localize('manageFirewallRulesMsgItem', 'Manage Firewall Rules') };
        const message: string = localize(
            'connectedDatabase', 'Database "{0}" connected to web app "{1}". Created the following application settings: {2}',
            createdDatabase.label, this.parent.site.fullName, Array.from(newAppSettings.keys()).join(', '));
        // Don't wait
        const buttons: vscode.MessageItem[] = [revealDatabase];
        if (createdDatabase.cosmosExtensionItem.azureData && createdDatabase.cosmosExtensionItem.postgresData) {
            buttons.push(manageFirewallRules);
        }
        void vscode.window.showInformationMessage(message, ...buttons).then(async (result: vscode.MessageItem | undefined) => {
            if (result === revealDatabase) {
                await revealConnection(context, createdDatabase);
            } else if (result === manageFirewallRules) {
                const accountId: string | undefined = createdDatabase.cosmosExtensionItem.azureData?.accountId;
                await openInPortal(this, `${accountId}/connectionSecurity`);
            }
        });
        return createdDatabase;
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
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
        const portDefault = '5432';
        const result: IDetectedConnection[] = [];
        const regexp = new RegExp(`(.+)${pgHostSuffix}`, 'i');

        for (const key of Object.keys(appSettings)) {
            const match = key && key.match(regexp);
            if (match) {
                const prefix = match[1];
                const hostKey = prefix + pgHostSuffix;
                const dbNameKey = prefix + pgDbNameSuffix;
                const userKey = prefix + pgUserSuffix;
                const passKey = prefix + pgPassSuffix;
                const portKey = prefix + pgPortSuffix;

                if (appSettings[hostKey]) {
                    const keys: string[] = [hostKey, portKey];
                    for (const optionalKey of [userKey, passKey, dbNameKey]) {
                        if (appSettings[optionalKey]) {
                            keys.push(optionalKey);
                        }
                    }
                    result.push({
                        keys, postgresData:
                        {
                            hostName: appSettings[hostKey],
                            port: appSettings[portKey] ? appSettings[portKey] : portDefault,
                            username: appSettings[userKey],
                            password: appSettings[passKey],
                            databaseName: appSettings[dbNameKey]
                        }
                    });
                }
            }
        }
        return result;
    }

    private detectDocDBConnections(appSettings: { [propertyName: string]: string }): IDetectedConnection[] {
        const connectionStringEndpointPrefix = 'AccountEndpoint=';
        const connectionStringKeyPrefix = 'AccountKey=';

        const result: IDetectedConnection[] = [];
        const regexp = new RegExp(`(.+)${endpointSuffix}`, 'i');
        for (const key of Object.keys(appSettings)) {
            // First, check for connection string split up into multiple app settings (endpoint, key, and optional database id)
            const match = key && key.match(regexp);
            if (match) {
                const prefix = match[1];
                const endpointKey = prefix + endpointSuffix;
                const keyKey = prefix + keySuffix;
                const documentEndpoint: string | undefined = appSettings[endpointKey];
                const masterKey: string | undefined = appSettings[keyKey];

                if (documentEndpoint && masterKey) {
                    const keys: string[] = [endpointKey, keyKey];
                    let connectionString = `${connectionStringEndpointPrefix}${documentEndpoint};${connectionStringKeyPrefix}${masterKey};`;

                    const databaseKey = prefix + databaseSuffix;
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
}

interface IDetectedConnection {
    keys: string[];
    connectionString?: string;
    postgresData?: {
        hostName: string;
        port: string;
        databaseName: string | undefined;
        username: string | undefined;
        password: string | undefined;
    };
}

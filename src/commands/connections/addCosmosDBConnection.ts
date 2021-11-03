/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from '@azure/arm-appservice';
import * as vscode from 'vscode';
import { IAppSettingsClient, validateAppSettingKey } from 'vscode-azureappservice';
import { DBTreeItem } from 'vscode-azuredatabases';
import { AzExtParentTreeItem, AzExtTreeItem, IActionContext, openInPortal } from 'vscode-azureextensionui';
import { databaseSuffix, endpointSuffix, keySuffix, pgDbNameSuffix, pgHostSuffix, pgPassSuffix, pgPortSuffix, pgUserSuffix } from '../../constants';
import { ext } from "../../extensionVariables";
import { localize } from '../../localize';
import { CosmosDBTreeItem } from '../../tree/CosmosDBTreeItem';
import { nonNullProp } from '../../utils/nonNull';
import { revealConnection } from './revealConnection';

export async function addCosmosDBConnection(context: IActionContext, node?: AzExtTreeItem, database?: DBTreeItem): Promise<void> {
    if (!node) {
        node = <CosmosDBTreeItem>await ext.tree.showTreeItemPicker([CosmosDBTreeItem.contextValueNotInstalled, CosmosDBTreeItem.contextValueInstalled], context);
    }
    let cosmosDBTreeItem: AzExtParentTreeItem;
    if (node instanceof CosmosDBTreeItem) {
        cosmosDBTreeItem = node;
        if (database) {
            const newAppSettings = await setDatabasesAppSettings(context, database, <CosmosDBTreeItem>cosmosDBTreeItem);
            getCreatedDatabaseConnectionMessage(context, database, node, newAppSettings);
        } else {
            await cosmosDBTreeItem.createChild(context);
            await ext.tree.refresh(context, cosmosDBTreeItem);
        }
    } else {
        cosmosDBTreeItem = nonNullProp(node, 'parent');
        await cosmosDBTreeItem.createChild(context);
        await ext.tree.refresh(context, cosmosDBTreeItem);
    }

}

export async function setDatabasesAppSettings(context: IActionContext, databaseToAdd: DBTreeItem, node: CosmosDBTreeItem): Promise<Map<string, string>> {

    const client = await node.parent.site.createClient(context);
    const appSettingsDict = await client.listApplicationSettings();
    appSettingsDict.properties = appSettingsDict.properties || {};

    let newAppSettings: Map<string, string>;
    if (databaseToAdd.docDBData) {
        const docdbAppSettings = new Map([
            [endpointSuffix, nonNullProp(databaseToAdd, 'docDBData').documentEndpoint],
            [keySuffix, nonNullProp(databaseToAdd, 'docDBData').masterKey],
            [databaseSuffix, databaseToAdd.databaseName]
        ]);

        const docdbSuffixes = [endpointSuffix, keySuffix, databaseSuffix];
        newAppSettings = await promptForAppSettings(context, appSettingsDict, docdbAppSettings, docdbSuffixes, 'AZURE_COSMOS', node);
    } else if (databaseToAdd.postgresData) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const postgresAppSettings: Map<string | undefined, string | undefined> = new Map([
            [pgHostSuffix, databaseToAdd.hostName],
            [pgDbNameSuffix, databaseToAdd.databaseName],
            [pgUserSuffix, databaseToAdd.postgresData?.username],
            [pgPassSuffix, databaseToAdd.postgresData?.password],
            [pgPortSuffix, databaseToAdd.port]
        ]);
        const postgresSuffixes = [pgHostSuffix, pgDbNameSuffix, pgUserSuffix, pgPassSuffix, pgPortSuffix];
        newAppSettings = await promptForAppSettings(context, appSettingsDict, postgresAppSettings, postgresSuffixes, 'POSTGRES', node);
    } else {
        const mongoAppSettings: Map<string | undefined, string | undefined> = new Map([[undefined, databaseToAdd.connectionString]]);
        newAppSettings = await promptForAppSettings(context, appSettingsDict, mongoAppSettings, undefined, 'MONGO_URL', node);
    }

    for (const [k, v] of newAppSettings) {
        appSettingsDict.properties[k] = v;
    }

    await client.updateApplicationSettings(appSettingsDict);
    await node.parent.appSettingsNode.refresh(context);
    return newAppSettings;

}

export async function promptForAppSettings(context: IActionContext, appSettingsDict: WebSiteManagementModels.StringDictionary, accountAppSettings: Map<string | undefined, string | undefined>, suffixes: string[] | undefined, defaultPrefixString: string, node: CosmosDBTreeItem): Promise<Map<string, string>> {
    const prompt: string = suffixes ? localize('enterPrefix', 'Enter new connection setting prefix') : localize('enterKey', 'Enter new connection setting key');
    const errorMsg: string = suffixes ? localize('prefixError', 'Connection setting prefix cannot be empty.') : localize('keyError', 'Connection setting key cannot be empty.');
    const client = await node.parent.site.createClient(context);
    const appSettingsPrefix: string = await context.ui.showInputBox({
        prompt,
        stepName: 'connectionSettingPrefix',
        validateInput: (v: string): string | undefined => {
            if (!v) {
                return errorMsg;
            } else {
                return validateAppSettingPrefix(client, v, appSettingsDict, suffixes);
            }
        },
        value: defaultPrefixString
    });

    return getAppSettings(accountAppSettings, appSettingsPrefix);

}

export async function getAppSettings(appSettings: Map<string | undefined, string | undefined>, appSettingsPrefix: string): Promise<Map<string, string>> {
    const result: Map<string, string> = new Map<string, string>();
    for (const [key, value] of appSettings) {
        if (key && value) {
            result.set(appSettingsPrefix + key, value);
        } else if (value) {
            result.set(appSettingsPrefix, value);
        }
    }
    return result;
}

export function validateAppSettingPrefix(client: IAppSettingsClient, prefix: string, appSettingsDict: WebSiteManagementModels.StringDictionary, suffixes: string[] | undefined): string | undefined {
    if (suffixes) {
        return suffixes.reduce<string | undefined>((result, suffix) => result || validateAppSettingKey(appSettingsDict, client, prefix + suffix), undefined);
    }
    return validateAppSettingKey(appSettingsDict, client, prefix);
}

export function getCreatedDatabaseConnectionMessage(context: IActionContext, databaseToAdd: DBTreeItem, node: CosmosDBTreeItem, newAppSettings: Map<string, string>): void {
    const revealDatabase: vscode.MessageItem = { title: localize('reveal', 'Reveal Database') };
    const manageFirewallRules: vscode.MessageItem = { title: localize('manageFirewallRulesMsgItem', 'Manage Firewall Rules') };
    const message: string = localize(
        'connectedDatabase', 'Database "{0}" connected to web app "{1}". Created the following application settings: {2}',
        databaseToAdd.azureData?.accountName, node.parent.site.fullName, Array.from(newAppSettings.keys()).join(', '));
    // Don't wait
    const buttons: vscode.MessageItem[] = [revealDatabase];
    if (databaseToAdd.azureData && databaseToAdd.postgresData) {
        buttons.push(manageFirewallRules);
    }
    void vscode.window.showInformationMessage(message, ...buttons).then(async (result: vscode.MessageItem | undefined) => {
        if (result === revealDatabase) {
            // Don't wait
            await revealConnection(context, undefined, databaseToAdd);
        } else if (result === manageFirewallRules) {
            const accountId: string | undefined = databaseToAdd.azureData?.accountName;
            await openInPortal(node, `${accountId}/connectionSecurity`);
        }
    });
}





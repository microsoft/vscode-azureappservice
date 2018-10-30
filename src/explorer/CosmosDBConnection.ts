/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { ISiteTreeRoot } from 'vscode-azureappservice';
import { AzureTreeItem, DialogResponses, UserCancelledError } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { CosmosDBDatabase } from '../vscode-cosmos.api';
import { CosmosDBTreeItem } from './CosmosDBTreeItem';

export class CosmosDBConnection extends AzureTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'cosmosDBConnection';
    public readonly contextValue: string = CosmosDBConnection.contextValue;
    public readonly label: string;
    public readonly parent: CosmosDBTreeItem;

    constructor(parent: CosmosDBTreeItem, readonly cosmosDBDatabase: CosmosDBDatabase, readonly appSettingName: string) {
        super(parent);
        this.label = `${cosmosDBDatabase.accountName}${cosmosDBDatabase.databaseName ? '/'.concat(cosmosDBDatabase.databaseName) : ''}`;
    }

    public get iconPath(): string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'Database.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'Database.svg')
        };
    }

    public async deleteTreeItemImpl(): Promise<void> {
        const valueToDelete = this.cosmosDBDatabase.connectionString;

        const appSettings = await this.root.client.listApplicationSettings();
        // tslint:disable-next-line:strict-boolean-expressions
        const properties = appSettings.properties || {};
        const keysToDelete: string[] = [];
        Object.keys(properties).forEach((key) => {
            if (properties[key] === valueToDelete) {
                keysToDelete.push(key);
            }
        });

        if (keysToDelete.length > 0) {
            const warning: string = `This will delete your existing ${keysToDelete.map((s) => `"${s}"`).join(', ')} Application Setting${keysToDelete.length > 1 ? "s" : ""}. Are you sure you want to delete this connection?`;
            const items: vscode.MessageItem[] = [DialogResponses.yes, DialogResponses.cancel];
            const result: vscode.MessageItem = await ext.ui.showWarningMessage(warning, { modal: true }, ...items);
            if (result === DialogResponses.cancel) {
                throw new UserCancelledError();
            }
        }
        const propertiesToSave: { [propertyname: string]: string } = {};
        Object.keys(properties).forEach((key) => {
            if (!keysToDelete.find((str) => { return str === key; })) {
                propertiesToSave[key] = properties[key];
            }
        });
        appSettings.properties = propertiesToSave;
        await this.root.client.updateApplicationSettings(appSettings);
        await this.parent.parent.parent.appSettingsNode.refresh();
    }
}

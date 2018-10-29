/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { ISiteTreeRoot } from 'vscode-azureappservice';
import { AzureTreeItem } from 'vscode-azureextensionui';
import { CosmosDBItem } from '../vscode-cosmos.api';
import { CosmosDBTreeItem } from './CosmosDBTreeItem';

export class CosmosDBDatabase extends AzureTreeItem<ISiteTreeRoot> {

    public get iconPath(): string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'Database.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'Database.svg')
        };
    }
    public static contextValue: string = 'cosmosDBDatabase';
    public readonly contextValue: string = CosmosDBDatabase.contextValue;
    public readonly label: string;
    public readonly parent: CosmosDBTreeItem;

    constructor(parent: CosmosDBTreeItem, readonly cosmosDBItem: CosmosDBItem, readonly appSettingName: string) {
        super(parent);
        if (cosmosDBItem.accountName && cosmosDBItem.databaseName) {
            this.label = `${cosmosDBItem.accountName}/${cosmosDBItem.databaseName}`;
        } else {
            throw new Error("Couldn't get correct database from CosmosDB.");
        }
    }

    public async deleteTreeItemImpl(): Promise<void> {
        throw new Error('Not implemented yet!');
    }
}

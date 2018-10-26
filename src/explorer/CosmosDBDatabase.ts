/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { ISiteTreeRoot } from 'vscode-azureappservice';
import { AzureTreeItem } from 'vscode-azureextensionui';
import { CosmosDBTreeItem } from './CosmosDBTreeItem';

export class CosmosDBDatabase extends AzureTreeItem<ISiteTreeRoot> {

    public get iconPath(): string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'Database.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'Database.svg')
        };
    }
    public static contextValue: string = 'cosmosDBDatabase';

    private static mongoPref: string = '[a-zA-Z]+:\/\/';
    private static mongoCredential: string = '(?:[^@]*@)?';
    private static mongoAccount: string = '([^\/]*)';
    private static mongoDatabase: string = '(\/[^\?]*)?';

    public readonly contextValue: string = CosmosDBDatabase.contextValue;
    public readonly label: string;
    public readonly parent: CosmosDBTreeItem;

    constructor(parent: CosmosDBTreeItem, readonly connectionId: string) {
        super(parent);
        this.label = this.getLabel(connectionId);
    }

    public async deleteTreeItemImpl(): Promise<void> {
        throw new Error('Not implemented yet!');
    }

    private getLabel(id: string): string {
        const items = this.mongoGetAccountDatabase(id);
        if (items) {
            const accountName = items[1];
            if (accountName.includes(',')) {
                throw new Error(`Don't suppoort mongo connections with multiple hosts yet.`);
            }
            let label = this.accountNameShorter(accountName);

            if (items.length === 3 && items[2].length > 1) {
                const databaseName = items[2];
                label = label.concat(databaseName);
            }

            return label;
        }
        throw new Error('Failed to parse connection id');
    }

    /**
     * Mongo connection string that supported follows the following format:
     * mongodb://[username:password@]account.documents.azure.com:10255[/[database][?ssl=true]]
     */
    private mongoGetAccountDatabase(id: string): RegExpMatchArray | undefined {
        const regExp = new RegExp(CosmosDBDatabase.mongoPref + CosmosDBDatabase.mongoCredential + CosmosDBDatabase.mongoAccount + CosmosDBDatabase.mongoDatabase);
        const matches: RegExpMatchArray | null = id.match(regExp);
        if (matches === null || matches.length <= 1) {
            return undefined;
        }
        return matches;
    }

    /**
     * Make account name shorter: account.documents.azure.com:10255 -> account
     * For now assume that only `.` can split
     */
    private accountNameShorter(accountName: string): string {
        const regExp = /[^.]*/;
        const matches = accountName.match(regExp);
        if (matches) {
            return matches[0];
        }
        return accountName;
    }
}

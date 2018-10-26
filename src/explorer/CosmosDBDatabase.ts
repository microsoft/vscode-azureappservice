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
    public static contextValue: string = 'cosmosDBDatabase';
    public readonly contextValue: string = CosmosDBDatabase.contextValue;
    public readonly label: string;
    public readonly parent: CosmosDBTreeItem;

    constructor(parent: CosmosDBTreeItem, readonly connectionId: string) {
        super(parent);
        this.label = this.getLabel(connectionId);
    }

    public get iconPath(): string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'Database.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'Database.svg')
        };
    }

    public async deleteTreeItemImpl(): Promise<void> {
        throw new Error('Not implemented yet!');
    }

    private getLabel(id: string): string {
        const items = this.parseMongoWithPassword(id);
        if (!items) {
            throw new Error('Failed to parse connection id');
        }
        return items[items.length - 2] + String("/") + items[items.length - 1];
    }

    private parseMongoWithPassword(id: string): RegExpMatchArray | undefined {
        const regExp = /([a-zA-Z]+:\/\/[^@]*)@([^/\. "$*<>:|?\/]*)[^\/]*\/?([^/?]+)?/;
        const matches: RegExpMatchArray | null = id.match(regExp);
        if (matches === null || matches.length !== 4) {
            return undefined;
        }
        return matches;
    }
}

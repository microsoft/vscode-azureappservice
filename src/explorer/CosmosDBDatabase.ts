/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ISiteTreeRoot } from 'vscode-azureappservice';
import { AzureParentTreeItem, AzureTreeItem } from 'vscode-azureextensionui';

export class CosmosDBDatabase extends AzureTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'cosmosDBDatabase';
    public readonly contextValue: string = CosmosDBDatabase.contextValue;
    public readonly label: string;

    constructor(parent: AzureParentTreeItem, readonly connectionId: string) {
        super(parent);
        this.label = this.getLabel(connectionId);
    }

    private getLabel(id: string): string {
        const items = this.parseCosmos(id) || this.parseAttached(id);
        if (!items) {
            throw new Error('Failed to parse connection id');
        }
        return items[items.length - 1];
    }

    private parseCosmos(id: string): RegExpMatchArray | undefined {
        const matches: RegExpMatchArray | null = id.match('subscriptions\/(.*)resourceGroups\/(.*)providers\/(.*)databaseAccounts\/(.*)');
        if (matches === null || matches.length < 5) {
            return undefined;
        }
        return matches;
    }

    private parseAttached(id: string): RegExpMatchArray | undefined {
        const matches: RegExpMatchArray | null = id.match('cosmosDBAttachedAccounts\/(.*)');
        if (matches === null || matches.length < 2) {
            return undefined;
        }
        return matches;
    }
}

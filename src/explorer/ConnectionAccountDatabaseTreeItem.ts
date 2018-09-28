/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteClient } from 'vscode-azureappservice';
import { IAzureTreeItem } from 'vscode-azureextensionui';

export class ConnectionAccountDatabaseTreeItem implements IAzureTreeItem {
    public static contextValue: string = 'connectionAccountDatabase';
    public readonly contextValue: string = ConnectionAccountDatabaseTreeItem.contextValue;
    public readonly label: string;

    constructor(readonly client: SiteClient, readonly connectionId: string) {
        this.label = this.getLabel(connectionId);
    }

    private getLabel(id: string): string {
        const items = this.parseCosmos(id) || this.parseAttached(id) || undefined;
        if (!items) {
            throw new Error('Id doesn\'t match any of known connection patterns');
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

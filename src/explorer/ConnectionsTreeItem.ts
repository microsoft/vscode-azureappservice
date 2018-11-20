/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { ISiteTreeRoot } from 'vscode-azureappservice';
import { AzureParentTreeItem, AzureTreeItem } from 'vscode-azureextensionui';
import { CosmosDBConnection } from './CosmosDBConnection';
import { CosmosDBTreeItem } from './CosmosDBTreeItem';
import { SiteTreeItem } from './SiteTreeItem';

export class ConnectionsTreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'connections';
    public readonly contextValue: string = ConnectionsTreeItem.contextValue;
    public readonly label: string = 'Connections';
    public readonly parent: SiteTreeItem;

    private readonly _cosmosDBNode: CosmosDBTreeItem;

    constructor(parent: SiteTreeItem) {
        super(parent);
        this._cosmosDBNode = new CosmosDBTreeItem(this);
    }

    public get iconPath(): { light: string, dark: string } {
        const iconName = 'Connections_16x.svg';
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', iconName),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', iconName)
        };
    }

    public async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzureTreeItem<ISiteTreeRoot>[]> {
        return [this._cosmosDBNode];
    }

    public pickTreeItemImpl(expectedContextValue: string): AzureTreeItem<ISiteTreeRoot> | undefined {
        switch (expectedContextValue) {
            case CosmosDBTreeItem.contextValueInstalled:
            case CosmosDBTreeItem.contextValueNotInstalled:
            case CosmosDBConnection.contextValue:
                return this._cosmosDBNode;
            default:
                return undefined;
        }
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { ISiteTreeRoot } from 'vscode-azureappservice';
import { AzureParentTreeItem, AzureTreeItem } from 'vscode-azureextensionui';
import { CosmosDBTreeItem } from './CosmosDBTreeItem';
import { WebAppTreeItem } from './WebAppTreeItem';

export class ConnectionsTreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'connections';
    public readonly contextValue: string = ConnectionsTreeItem.contextValue;
    public readonly cosmosDBNode: CosmosDBTreeItem;
    public readonly label: string = 'Connections';
    public readonly parent: WebAppTreeItem;

    constructor(parent: WebAppTreeItem) {
        super(parent);
        this.cosmosDBNode = new CosmosDBTreeItem(this);
    }

    public get iconPath(): { light: string, dark: string } {
        const iconName = 'Connections_16x.svg';
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', iconName),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', iconName)
        };
    }

    public async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzureTreeItem<ISiteTreeRoot>[]> {
        return [this.cosmosDBNode];
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }
}

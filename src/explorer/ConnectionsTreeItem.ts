/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { SiteClient } from 'vscode-azureappservice';
import { IAzureNode, IAzureParentTreeItem, IAzureTreeItem } from 'vscode-azureextensionui';
import { CosmosDBTreeItem } from './CosmosDBTreeItem';

export class ConnectionsTreeItem implements IAzureParentTreeItem {
    public static contextValue: string = 'Connections';
    public readonly contextValue: string = ConnectionsTreeItem.contextValue;
    public readonly label: string = 'Connections';
    public cosmosDBNode: IAzureTreeItem;

    constructor(readonly client: SiteClient) {
    }

    public get iconPath(): { light: string, dark: string } {
        const iconName = 'Connections_16x.svg';
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', iconName),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', iconName)
        };
    }

    public async loadMoreChildren(_node: IAzureNode<IAzureTreeItem>, _clearCache: boolean): Promise<IAzureTreeItem[]> {
        this.cosmosDBNode = new CosmosDBTreeItem(this.client);
        return [this.cosmosDBNode];
    }

    public hasMoreChildren(): boolean {
        return false;
    }
}

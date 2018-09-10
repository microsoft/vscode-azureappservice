/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteClient } from 'vscode-azureappservice';
import { IAzureNode, IAzureParentTreeItem, IAzureTreeItem } from 'vscode-azureextensionui';

export class CosmosDBTreeItem implements IAzureParentTreeItem {
    public static contextValue: string = 'Connection';
    public readonly contextValue: string = CosmosDBTreeItem.contextValue;
    public readonly label: string = 'CosmosDB';

    constructor(readonly client: SiteClient) {
    }

    public async loadMoreChildren(_node: IAzureNode<IAzureTreeItem>, _clearCache: boolean): Promise<IAzureTreeItem[]> {
        throw new Error('Method not implemented.');
    }

    public hasMoreChildren(): boolean {
        return false;
    }
}

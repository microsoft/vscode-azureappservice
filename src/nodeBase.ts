/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureAccountWrapper } from './azureAccountWrapper';
import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter, Event, OutputChannel } from 'vscode';

export class NodeBase {
    readonly label: string;

    protected constructor(label: string) {
        this.label = label;
    }

    getTreeItem(): TreeItem {
        return { 
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.None
        };
    }

    async getChildren(azureAccount: AzureAccountWrapper): Promise<NodeBase[]> {
        return [];
    }
}
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeDataProvider, TreeItem, TreeItemCollapsibleState } from 'vscode';

export class NodeBase {
    readonly label: string;

    protected constructor(label: string, private readonly treeDataProvider: TreeDataProvider<NodeBase>, private readonly parentNode?: NodeBase) {
        this.label = label;
    }

    getTreeItem(): TreeItem {
        return { 
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.None
        };
    }

    getTreeDataProvider<T extends TreeDataProvider<NodeBase>>(): T {
        return <T>this.treeDataProvider;
    }

    getParentNode<T extends NodeBase>(): T {
        return <T>this.parentNode;
    }

    async getChildren(): Promise<NodeBase[]> {
        return [];
    }

    openInPortal?(): void
}
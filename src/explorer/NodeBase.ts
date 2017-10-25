/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeDataProvider, TreeItem, TreeItemCollapsibleState } from 'vscode';

export class NodeBase {
    public label: string;
    private readonly treeDataProvider: TreeDataProvider<NodeBase>;
    private readonly parentNode?: NodeBase;

    protected constructor(label: string, treeDataProvider: TreeDataProvider<NodeBase>, parentNode?: NodeBase) {
        this.label = label;
        this.treeDataProvider = treeDataProvider;
        this.parentNode = parentNode;
    }

    public getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.None
        };
    }

    public getTreeDataProvider<T extends TreeDataProvider<NodeBase>>(): T {
        return <T>this.treeDataProvider;
    }

    public getParentNode<T extends NodeBase>(): T {
        return <T>this.parentNode;
    }

    public async getChildren(): Promise<NodeBase[]> {
        return [];
    }

    public openInPortal?(): void;
}

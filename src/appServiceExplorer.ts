/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeDataProvider, TreeItem, EventEmitter, Event } from 'vscode';
import { AzureSignIn } from './azureSignIn';
import { NodeBase, AppServiceNode, SubscriptionNode, NotSignedInNode } from './appServiceNodes';

export class AppServiceDataProvider implements TreeDataProvider<NodeBase> {
    private _onDidChangeTreeData: EventEmitter<NodeBase> = new EventEmitter<NodeBase>();
    readonly onDidChangeTreeData: Event<NodeBase> = this._onDidChangeTreeData.event;

    constructor(private azureSignIn: AzureSignIn) {
        this.azureSignIn.registerSessionsChangedListener(this.onSessionsChanged, this);
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: NodeBase): TreeItem {
        return element.getTreeItem();
    }

    getChildren(element?: NodeBase): NodeBase[] | Thenable<NodeBase[]> {
        if (this.azureSignIn.signInStatus !== 'LoggedIn') {
            return [new NotSignedInNode()];
        }

        if (!element) {     // Top level, no parent element.
            return this.getSubscriptions();
        }

        return element.getChildren(this.azureSignIn);
    }

    private async getSubscriptions(): Promise<SubscriptionNode[]> {
        const subscriptions = await this.azureSignIn.getSubscriptions();
        const nodes = subscriptions.map<SubscriptionNode>((subscription, index, array) =>{
            return new SubscriptionNode(subscription);
        });

        return nodes;
    }

    private onSessionsChanged() {
        this.refresh();
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeDataProvider, TreeItem, EventEmitter, Event } from 'vscode';
import { AzureAccountWrapper } from './azureAccountWrapper';
import { AppServiceNode, SubscriptionNode, NotSignedInNode, LoadingNode } from './nodes/appServiceNodes';
import { NodeBase } from './nodes/nodeBase';

export class AppServiceDataProvider implements TreeDataProvider<NodeBase> {
    private _onDidChangeTreeData: EventEmitter<NodeBase> = new EventEmitter<NodeBase>();
    readonly onDidChangeTreeData: Event<NodeBase> = this._onDidChangeTreeData.event;

    constructor(private azureAccount: AzureAccountWrapper) {
        this.azureAccount.registerSessionsChangedListener(this.onSubscriptionChanged, this);
        this.azureAccount.registerFiltersChangedListener(this.onSubscriptionChanged, this);
    }

    refresh(element?: NodeBase): void {
        this._onDidChangeTreeData.fire(element);
    }

    getTreeItem(element: NodeBase): TreeItem {
        return element.getTreeItem();
    }

    getChildren(element?: NodeBase): NodeBase[] | Thenable<NodeBase[]> {
        if (this.azureAccount.signInStatus === 'Initializing' || this.azureAccount.signInStatus === 'LoggingIn' ) {
            return [new LoadingNode()];
        }

        if (this.azureAccount.signInStatus === 'LoggedOut') {
            return [new NotSignedInNode()];
        }

        if (!element) {     // Top level, no parent element.
            return this.getSubscriptions();
        }

        return element.getChildren(this.azureAccount);
    }

    private async getSubscriptions(): Promise<SubscriptionNode[]> {
        const subscriptions = await this.azureAccount.getFilteredSubscriptions();
        const nodes = subscriptions.map<SubscriptionNode>((subscription, index, array) =>{
            return new SubscriptionNode(subscription);
        });

        return nodes;
    }

    private onSubscriptionChanged() {
        this.refresh();
    }
}

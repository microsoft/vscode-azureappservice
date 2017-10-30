/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event, EventEmitter, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from 'vscode';
import { AzureAccountWrapper } from '../AzureAccountWrapper';
import * as util from '../util';
import { NodeBase } from './NodeBase';
import { SelectSubscriptionsNode, SubscriptionNode } from './SubscriptionNode';

export class AppServiceDataProvider implements TreeDataProvider<NodeBase> {
    public readonly onDidChangeTreeData: Event<NodeBase>;
    private _onDidChangeTreeData: EventEmitter<NodeBase> = new EventEmitter<NodeBase>();
    private readonly _azureAccount: AzureAccountWrapper;

    constructor(azureAccount: AzureAccountWrapper) {
        this._azureAccount = azureAccount;
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this._azureAccount.registerStatusChangedListener(this.onSubscriptionChanged, this);
        this._azureAccount.registerFiltersChangedListener(this.onSubscriptionChanged, this);

    }

    public refresh(element?: NodeBase): void {
        this._onDidChangeTreeData.fire(element);
    }

    public getTreeItem(element: NodeBase): TreeItem {
        return element.getTreeItem();
    }

    public getChildren(element?: NodeBase): NodeBase[] | Thenable<NodeBase[]> {
        if (this.azureAccount.signInStatus === 'Initializing' || this.azureAccount.signInStatus === 'LoggingIn') {
            return [new LoadingNode(this)];
        }

        if (this.azureAccount.signInStatus === 'LoggedOut') {
            return [new NotSignedInNode(this)];
        }

        if (!element) {     // Top level, no parent element.
            return this.getSubscriptions();
        }

        return element.getChildren();
    }

    get azureAccount(): AzureAccountWrapper {
        return this._azureAccount;
    }

    private async getSubscriptions(): Promise<NodeBase[]> {
        const subscriptions = await this.azureAccount.getFilteredSubscriptions();

        if (subscriptions.length > 0) {
            return subscriptions.map<SubscriptionNode>(subscription => {
                return new SubscriptionNode(subscription, this, null);
            });
        }

        return [new SelectSubscriptionsNode(this, null)];
    }

    private onSubscriptionChanged(): void {
        this.refresh();
    }
}

export class NotSignedInNode extends NodeBase {
    constructor(treeDataProvider: AppServiceDataProvider, parentNode?: NodeBase) {
        super('Sign in to Azure...', treeDataProvider, parentNode);
    }

    public getTreeItem(): TreeItem {
        return {
            label: this.label,
            command: {
                title: this.label,
                command: util.getSignInCommandString()
            },
            collapsibleState: TreeItemCollapsibleState.None
        };
    }
}

export class LoadingNode extends NodeBase {
    constructor(treeDataProvider: AppServiceDataProvider, parentNode?: NodeBase) {
        super('Loading...', treeDataProvider, parentNode);
    }

    public getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.None
        };
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeDataProvider, TreeItemCollapsibleState, TreeItem, EventEmitter, Event } from 'vscode';
import { AzureAccountWrapper } from '../azureAccountWrapper';
import { SubscriptionNode } from './subscriptionNode';
import { NodeBase } from './nodeBase';
import * as util from '../util';

export class AppServiceDataProvider implements TreeDataProvider<NodeBase> {
    private readonly _azureAccount;
    private _onDidChangeTreeData: EventEmitter<NodeBase> = new EventEmitter<NodeBase>();
    public readonly onDidChangeTreeData: Event<NodeBase> = this._onDidChangeTreeData.event;

    constructor(azureAccount: AzureAccountWrapper) {
        this._azureAccount = azureAccount;
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

    public get azureAccount(): AzureAccountWrapper {
        return this._azureAccount;
    }

    private async getSubscriptions(): Promise<NodeBase[]> {
        const subscriptions = await this.azureAccount.getFilteredSubscriptions();

        if (subscriptions.length > 0) {
            const nodes = subscriptions.map<SubscriptionNode>(subscription => {
                return new SubscriptionNode(subscription, this, null);
            });

            return nodes;
        }

        return [new SelectSubscriptionsNode(this, null)];
    }

    private onSubscriptionChanged() {
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
        }
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
        }
    }
}

export class SelectSubscriptionsNode extends NodeBase {
    constructor(treeDataProvider: AppServiceDataProvider, parentNode?: NodeBase) {
        super('Select Subscriptions...', treeDataProvider, parentNode);
    }

    public getTreeItem(): TreeItem {
        return {
            label: this.label,
            command: {
                title: this.label,
                command: 'azure-account.selectSubscriptions'
            },
            collapsibleState: TreeItemCollapsibleState.None
        }
    }
}
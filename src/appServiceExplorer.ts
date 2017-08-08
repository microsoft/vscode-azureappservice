/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter, Event } from "vscode";
import { ServiceClientCredentials } from 'ms-rest';
import { SubscriptionClient } from "azure-arm-resource";
import WebSiteManagementClient = require("azure-arm-website");
import { AzureSignIn, NotSignedInError } from "./azureSignIn";
import { AzureAccount } from './azurelogin.api';

class NodeBase {
    readonly label: string;

    protected constructor(label: string) {
        this.label = label;
    }

    getTreeItem(): TreeItem {
        return {
            label: "You are not supposed to see this",
            collapsibleState: TreeItemCollapsibleState.None
        }
    }

    async getChildren(credential: ServiceClientCredentials): Promise<NodeBase[]> {
        return [];
    }
}

class SubscriptionNode extends NodeBase {
    readonly subscriptionId: string;

    constructor(label: string, subscriptionId: string) {
        super(label);
        this.subscriptionId = subscriptionId;
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Collapsed
        }
    }

    async getChildren(credential: ServiceClientCredentials): Promise<NodeBase[]> {
        const client = new WebSiteManagementClient(credential, this.subscriptionId);
        const webApps = await client.webApps.list();
        const nodes = webApps.map<AppServiceNode>((site, index, array) => {
            return new AppServiceNode('📊 ' + site.name);
        });

        return nodes;
    }
}

class AppServiceNode extends NodeBase {

    constructor(label: string) {
        super(label);
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.None
        }
    }
}

class NotSignedInNode extends NodeBase {
    constructor() {
        super("Azure Sign In")
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.None
        }
    }
}

export class AppServiceDataProvider implements TreeDataProvider<NodeBase> {
    private _onDidChangeTreeData: EventEmitter<NodeBase | undefined> = new EventEmitter<NodeBase | undefined>();
    readonly onDidChangeTreeData: Event<NodeBase | undefined> = this._onDidChangeTreeData.event;

    constructor(private azureSignIn: AzureSignIn) {
        this.azureSignIn.registerAccountChangedListener(this.onAccountChanged, this);
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: NodeBase): TreeItem {
        return element.getTreeItem();
    }

    getChildren(element?: NodeBase): NodeBase[] | Thenable<NodeBase[]> {
        var cred: ServiceClientCredentials;

        try {
            cred = this.azureSignIn.getCredential();    
        } catch (e) {
            if (e instanceof NotSignedInError) {
                return [new NotSignedInNode()];
            }

            throw e
        }
        
        if (!element) {
            return this.getSubscriptions(cred);
        }

        return element.getChildren(cred);
    }

    private async getSubscriptions(credential: ServiceClientCredentials): Promise<SubscriptionNode[]> {
        const subscriptions = await this.azureSignIn.getSubscriptions();
        const nodes = subscriptions.map<SubscriptionNode>((subscription, index, array) =>{
            return new SubscriptionNode('📰 '+ subscription.displayName, subscription.subscriptionId);
        });

        return nodes;
    }

    private onAccountChanged(e: AzureAccount) {
        this.refresh();
    }
}
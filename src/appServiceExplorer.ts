/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from "vscode";
import { ServiceClientCredentials } from 'ms-rest';
import { SubscriptionClient } from "azure-arm-resource";
import WebSiteManagementClient = require("azure-arm-website");
import { AzureCredential, NotSignedInError } from "./azureCredential";

class NodeBase {
    public readonly label: string;

    protected constructor(label: string) {
        this.label = label;
    }

    public getTreeItem(): TreeItem {
        return {
            label: "You are not supposed to see this",
            collapsibleState: TreeItemCollapsibleState.None
        }
    }

    public async getChildren(credential: ServiceClientCredentials): Promise<NodeBase[]> {
        return [];
    }
}

class SubscriptionNode extends NodeBase {
    public readonly subscriptionId: string;

    constructor(label: string, subscriptionId: string) {
        super(label);
        this.subscriptionId = subscriptionId;
    }

    public getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Collapsed
        }
    }

    public async getChildren(credential: ServiceClientCredentials): Promise<NodeBase[]> {
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

    public getTreeItem(): TreeItem {
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

    public getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.None
        }
    }
}

export class AppServiceDataProvider implements TreeDataProvider<NodeBase> {
        private azureCredential: AzureCredential | null;

        constructor(private context: ExtensionContext) {
            this.azureCredential = new AzureCredential(context)
        }

        public getTreeItem(element: NodeBase): TreeItem {
            return element.getTreeItem();
        }

        public getChildren(element?: NodeBase): NodeBase[] | Thenable<NodeBase[]> {
            var cred: ServiceClientCredentials;

            try {
                cred = this.azureCredential.getCredential();    
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
            const client = new SubscriptionClient(credential);
            const subscriptions = await client.subscriptions.list();
            const nodes = subscriptions.map<SubscriptionNode>((subscription, index, array) =>{
                return new SubscriptionNode('📰 '+ subscription.displayName, subscription.subscriptionId);
            });

            return nodes;
        }
}
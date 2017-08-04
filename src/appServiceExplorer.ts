/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

 import { ExtensionContext, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from "vscode";
import { ServiceClientCredentials } from 'ms-rest';
import { SubscriptionClient } from "azure-arm-resource";
import WebSiteManagementClient = require("azure-arm-website");
import { AzureCredential, NotSignedInError } from "./azureCredential";

export class NodeBase {
    public readonly label: string;

    constructor(label: string) {
        this.label = label;
    }
}

export class SubscriptionNode extends NodeBase {
    public readonly subscriptionId: string;

    constructor(label: string, subscriptionId: string) {
        super(label);
        this.subscriptionId = subscriptionId;
    }
}

export class AppServiceNode extends NodeBase {
}

export class NotSignedInNode extends NodeBase {
    constructor() {
        super("Azure Sign In")
    }
}

export class AppServiceDataProvider implements TreeDataProvider<NodeBase> {
        private azureCredential: AzureCredential | null;

        constructor(private context: ExtensionContext) {
            this.azureCredential = new AzureCredential(context)
        }

        public getTreeItem(element: NodeBase): TreeItem {
            if (element instanceof SubscriptionNode) {
                return {
                    label: element.label,
                    collapsibleState: TreeItemCollapsibleState.Collapsed
                }
            }

            if (element instanceof AppServiceNode) {
                return {
                    label: element.label,
                    collapsibleState: TreeItemCollapsibleState.Collapsed
                }
            }

            return {
                label: "Place Holder"
            };
        }

        public getChildren(element?: NodeBase): NodeBase[] | Thenable<NodeBase[]> {
            var cred: ServiceClientCredentials;

            try {
                cred = this.azureCredential.getCredential();    
            } catch (e) {
                if (e instanceof NotSignedInNode) {
                    return [new NotSignedInNode()];
                }

                throw e
            }
            
            if (!element) {
                return this.getSubscriptions(cred);
            }

            if (element instanceof SubscriptionNode) {
                return this.getAppServices(cred, element.subscriptionId);
            }

            return [];
        }

        private async getSubscriptions(credential: ServiceClientCredentials): Promise<SubscriptionNode[]> {
            const client = new SubscriptionClient(credential);
            const subscriptions = await client.subscriptions.list();
            const nodes = subscriptions.map<SubscriptionNode>((subscription, index, array) =>{
                return new SubscriptionNode('📰 '+ subscription.displayName, subscription.subscriptionId);
            });

            return nodes;
        }

        private async getAppServices(credential: ServiceClientCredentials, subscriptionId: string): Promise<AppServiceNode[]> {
            const client = new WebSiteManagementClient(credential, subscriptionId);
            const webApps = await client.webApps.list();
            const nodes = webApps.map<AppServiceNode>((site, index, array) => {
                return new AppServiceNode('📊 ' + site.name);
            });

            return nodes;
        }
}
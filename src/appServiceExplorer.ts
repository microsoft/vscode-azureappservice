/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter, Event } from 'vscode';
import { ServiceClientCredentials } from 'ms-rest';
import { SubscriptionClient, SubscriptionModels } from 'azure-arm-resource';
import WebSiteManagementClient = require('azure-arm-website');
import * as WebSiteModels from '../node_modules/azure-arm-website/lib/models';
import { AzureSignIn, NotSignedInError } from './azureSignIn';
import * as path from 'path';
import * as opn from 'opn';

class NodeBase {
    readonly label: string;

    protected constructor(label: string) {
        this.label = label;
    }

    getTreeItem(): TreeItem {
        return {
            label: 'You are not supposed to see this',
            collapsibleState: TreeItemCollapsibleState.None
        }
    }

    async getChildren(azureSignIn: AzureSignIn): Promise<NodeBase[]> {
        return [];
    }
}

export class SubscriptionNode extends NodeBase {
    constructor(readonly subscription: SubscriptionModels.Subscription) {
        super(`📰 ${subscription.displayName}`);
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Collapsed
        }
    }

    async getChildren(azureSignIn: AzureSignIn): Promise<NodeBase[]> {
        if (azureSignIn.signInStatus !== 'LoggedIn') {
            return [];
        }

        const credential = azureSignIn.getCredentialByTenantId(this.subscription.tenantId);
        const client = new WebSiteManagementClient(credential, this.subscription.subscriptionId);
        const webApps = await client.webApps.list();
        const nodes = webApps.sort((a, b) => {
            let n = a.resourceGroup.localeCompare(b.resourceGroup);

            if (n !== 0) {
                return n;
            }

            return a.name.localeCompare(b.name);
        }).map<AppServiceNode>((site, index, array) => {
            return new AppServiceNode(site, this.subscription);
        });

        return nodes;
    }
}

export class AppServiceNode extends NodeBase {
    constructor(readonly site: WebSiteModels.Site, readonly subscription: SubscriptionModels.Subscription) {
        super(site.name);
    }

    getTreeItem(): TreeItem {
        let iconName = this.site.kind.startsWith('functionapp') ? 'AzureFunctionsApp_16x_vscode.svg' : 'AzureWebsite_16x_vscode.svg';
        return {
            label: `${this.label} (${this.site.resourceGroup})`,
            collapsibleState: TreeItemCollapsibleState.None,
            contextValue: 'appService',
            iconPath: { 
                light: path.join(__filename, '..', '..', '..', 'resources', 'light', iconName),
                dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', iconName)
            }
        }
    }

    browse(): void {
        const defaultHostName = this.site.defaultHostName;
        const isSsl = this.site.hostNameSslStates.findIndex((value, index, arr) => 
            value.name === defaultHostName && value.sslState === "Enabled");
        const uri = `${isSsl ? 'https://' : 'http://'}${defaultHostName}`;
        opn(uri);
    }

    openInPortal(azureSignIn: AzureSignIn): void {
        const portalEndpoint = 'https://portal.azure.com';
        const deepLink = `${portalEndpoint}/${this.subscription.tenantId}/#resource${this.site.id}`;
        opn(deepLink);
    }

    async start(azureSignIn: AzureSignIn): Promise<void> {
        const client = new WebSiteManagementClient(azureSignIn.getCredentialByTenantId(this.subscription.tenantId), this.subscription.subscriptionId);
        return client.webApps.start(this.site.resourceGroup, this.site.name);
    }

    async stop(azureSignIn: AzureSignIn): Promise<void> {
        const client = new WebSiteManagementClient(azureSignIn.getCredentialByTenantId(this.subscription.tenantId), this.subscription.subscriptionId);
        return client.webApps.stop(this.site.resourceGroup, this.site.name);
    }

    async restart(azureSignIn: AzureSignIn): Promise<void> {
        const client = new WebSiteManagementClient(azureSignIn.getCredentialByTenantId(this.subscription.tenantId), this.subscription.subscriptionId);
        return client.webApps.restart(this.site.resourceGroup, this.site.name);
    }
}

export class NotSignedInNode extends NodeBase {
    constructor() {
        super('Azure Sign In...')
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

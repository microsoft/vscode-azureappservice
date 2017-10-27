/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SubscriptionModels } from 'azure-arm-resource';
import WebSiteManagementClient = require('azure-arm-website');
import * as path from 'path';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { AzureAccountWrapper } from '../AzureAccountWrapper';
import { AppServiceDataProvider } from './AppServiceExplorer';
import { AppServiceNode } from './AppServiceNode';
import { NodeBase } from './NodeBase';

export class SubscriptionNode extends NodeBase {
    private readonly _subscription: SubscriptionModels.Subscription;
    constructor(subscription: SubscriptionModels.Subscription, treeDataProvider: AppServiceDataProvider, parentNode: NodeBase | undefined) {
        super(subscription.displayName, treeDataProvider, parentNode);
        this._subscription = subscription;
    }

    public get subscription(): SubscriptionModels.Subscription {
        return this._subscription;
    }

    public getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
            contextValue: 'subscription',
            iconPath: {
                light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'AzureSubscription_16x.svg'),
                dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'AzureSubscription_16x.svg')
            }
        };
    }

    public async getChildren(): Promise<NodeBase[]> {
        if (this.azureAccount.signInStatus !== 'LoggedIn') {
            return [];
        }

        const credential = this.azureAccount.getCredentialByTenantId(this._subscription.tenantId);
        const client = new WebSiteManagementClient(credential, this._subscription.subscriptionId);
        const webApps = await client.webApps.list();

        // logic to retrieve nodes from resourceGroup and filter out function apps
        return webApps.sort((a, b) => {
            const n = a.resourceGroup.localeCompare(b.resourceGroup);
            if (n !== 0) {
                return n;
            }

            return a.name.localeCompare(b.name);
        }).map<AppServiceNode>(site => {
            if (!site.kind.startsWith('functionapp')) {
                return new AppServiceNode(site, this._subscription, this.getTreeDataProvider(), this);
            }
            return undefined;
        });
    }

    private get azureAccount(): AzureAccountWrapper {
        return this.getTreeDataProvider<AppServiceDataProvider>().azureAccount;
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
        };
    }
}

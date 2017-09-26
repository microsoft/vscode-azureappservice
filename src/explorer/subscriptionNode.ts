/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter, Event, OutputChannel } from 'vscode';
import { AzureAccountWrapper } from '../azureAccountWrapper';
import { SubscriptionClient, SubscriptionModels } from 'azure-arm-resource';
import { AppServiceDataProvider } from './appServiceExplorer';
import { NodeBase } from './nodeBase';
import { AppServiceNode } from './appServiceNode';
import WebSiteManagementClient = require('azure-arm-website');
import * as path from 'path';


export class SubscriptionNode extends NodeBase {
    constructor(readonly subscription: SubscriptionModels.Subscription, treeDataProvider: AppServiceDataProvider, parentNode: NodeBase) {
        super(subscription.displayName, treeDataProvider, parentNode);
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
            contextValue: 'subscription',
            iconPath: { 
                light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'AzureSubscription_16x.svg'),
                dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'AzureSubscription_16x.svg')
            }
        }
    }

    async getChildren(): Promise<NodeBase[]> {
        if (this.azureAccount.signInStatus !== 'LoggedIn') {
            return [];
        }

        const credential = this.azureAccount.getCredentialByTenantId(this.subscription.tenantId);
        const client = new WebSiteManagementClient(credential, this.subscription.subscriptionId);
        const webApps = await client.webApps.list();
        const nodes = webApps.sort((a, b) => {
            let n = a.resourceGroup.localeCompare(b.resourceGroup);

            if (n !== 0) {
                return n;
            }

            return a.name.localeCompare(b.name);
        }).map<AppServiceNode>((site, index, array) => {
            return new AppServiceNode(site, this.subscription, this.getTreeDataProvider(), this);
        });

        return nodes;
    }

    private get azureAccount(): AzureAccountWrapper {
        return this.getTreeDataProvider<AppServiceDataProvider>().azureAccount;
    }
}

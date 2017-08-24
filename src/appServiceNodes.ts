/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter, Event } from 'vscode';
import { AzureAccountWrapper } from './azureAccountWrapper';
import { SubscriptionClient, SubscriptionModels } from 'azure-arm-resource';
import WebSiteManagementClient = require('azure-arm-website');
import * as WebSiteModels from '../node_modules/azure-arm-website/lib/models';
import * as path from 'path';
import * as opn from 'opn';

export class NodeBase {
    readonly label: string;

    protected constructor(label: string) {
        this.label = label;
    }

    getTreeItem(): TreeItem {
        return { 
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.None
        };
    }

    async getChildren(azureAccount: AzureAccountWrapper): Promise<NodeBase[]> {
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

    async getChildren(azureAccount: AzureAccountWrapper): Promise<NodeBase[]> {
        if (azureAccount.signInStatus !== 'LoggedIn') {
            return [];
        }

        const credential = azureAccount.getCredentialByTenantId(this.subscription.tenantId);
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
            collapsibleState: TreeItemCollapsibleState.Collapsed,
            contextValue: 'appService',
            iconPath: { 
                light: path.join(__filename, '..', '..', '..', 'resources', 'light', iconName),
                dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', iconName)
            }
        }
    }

    async getChildren(azureAccount: AzureAccountWrapper): Promise<NodeBase[]> {
        if (azureAccount.signInStatus !== 'LoggedIn') {
            return [];
        }

        var nodes = [
            new DeploymentSlotsNode(this.subscription),
            new FilesNode(this.subscription),
            new LogFilesNode(this.subscription),
            new WebJobsNode(this.subscription),
        ];

        return nodes;
    }

    browse(): void {
        const defaultHostName = this.site.defaultHostName;
        const isSsl = this.site.hostNameSslStates.findIndex((value, index, arr) => 
            value.name === defaultHostName && value.sslState === "Enabled");
        const uri = `${isSsl ? 'https://' : 'http://'}${defaultHostName}`;
        opn(uri);
    }

    openInPortal(azureAccount: AzureAccountWrapper): void {
        const portalEndpoint = 'https://portal.azure.com';
        const deepLink = `${portalEndpoint}/${this.subscription.tenantId}/#resource${this.site.id}`;
        opn(deepLink);
    }

    start(azureAccount: AzureAccountWrapper): Promise<void> {
        return this.getWebSiteManagementClient(azureAccount).webApps.start(this.site.resourceGroup, this.site.name);
    }

    stop(azureAccount: AzureAccountWrapper): Promise<void> {
        return this.getWebSiteManagementClient(azureAccount).webApps.stop(this.site.resourceGroup, this.site.name);
    }

    restart(azureAccount: AzureAccountWrapper): Promise<void> {
        return this.getWebSiteManagementClient(azureAccount).webApps.restart(this.site.resourceGroup, this.site.name);
    }

    private getWebSiteManagementClient(azureAccount: AzureAccountWrapper) {
        return new WebSiteManagementClient(azureAccount.getCredentialByTenantId(this.subscription.tenantId), this.subscription.subscriptionId);
    }
}

export class DeploymentSlotsNode extends NodeBase {
    constructor(readonly subscription: SubscriptionModels.Subscription) {
        super(`📊 Deployment Slots`);
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Collapsed
        }
    }
    
    async getChildren(azureAccount: AzureAccountWrapper): Promise<NodeBase[]> {
        //TODO implement the proper API calls to retrieve DeploymentSlots
        var nodes = [];
        return nodes;
    }
}

export class FilesNode extends NodeBase {
    constructor(readonly subscription: SubscriptionModels.Subscription) {
        super(`📁 Files`);
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Collapsed
        }
    }

    async getChildren(azureAccount: AzureAccountWrapper): Promise<NodeBase[]> {
        //TODO implement the proper API calls to retrieve File Directory
        var nodes = [];
        return nodes;
    }
}

export class LogFilesNode extends NodeBase {
    constructor(readonly subscription: SubscriptionModels.Subscription) {
        super(`📁 Log Files`);
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Collapsed
        }
    }

    async getChildren(azureAccount: AzureAccountWrapper): Promise<NodeBase[]> {
        //TODO implement the proper API calls to retrieve Log Files
        var nodes = [];

        return nodes;
    }
}

export class WebJobsNode extends NodeBase {
    constructor(readonly subscription: SubscriptionModels.Subscription) {
        super(`🌐 WebJobs`);
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Collapsed
        }
    }

    async getChildren(azureAccount: AzureAccountWrapper): Promise<NodeBase[]> {
        //TODO implement the proper API calls to retrieve WebJobs
        var nodes = [];
    
        return nodes;
    }
}

export class NotSignedInNode extends NodeBase {
    constructor() {
        super('Sign in to Azure...');
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            command: {
                title: this.label,
                command: 'azure-account.login'
            },
            collapsibleState: TreeItemCollapsibleState.None
        }
    }
}

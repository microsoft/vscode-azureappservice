/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeDataProvider, TreeItem, TreeItemCollapsibleState } from 'vscode';
import { AzureAccountWrapper } from '../azureAccountWrapper';
import { SubscriptionModels } from 'azure-arm-resource';
import * as WebSiteModels from '../../node_modules/azure-arm-website/lib/models';
import { AppServiceDataProvider } from './appServiceExplorer';
import { NodeBase } from './nodeBase';
import { SiteNodeBase } from './siteNodeBase';
import { DeploymentSlotNode } from './deploymentSlotNode';
import { DeploymentSlotsNode } from './deploymentSlotsNode';
import { FilesNode } from './filesNodes';
import { WebJobsNode } from './webJobsNode';
import { AppSettingsNode } from './appSettingsNodes';
import WebSiteManagementClient = require('azure-arm-website');
import * as path from 'path';
import * as util from '../util';

export class AppServiceNode extends SiteNodeBase {
    constructor(site: WebSiteModels.Site, subscription: SubscriptionModels.Subscription, treeDataProvider: AppServiceDataProvider, parentNode: NodeBase) {
        super(site.name, site, subscription, treeDataProvider, parentNode);
    }

    getTreeItem(): TreeItem {
        if (!this.site.kind.startsWith('functionapp')) {
            const iconName = 'AzureWebsite_16x_vscode.svg';
            return {
                label: `${this.label} (${this.site.resourceGroup})`,
                collapsibleState: TreeItemCollapsibleState.Collapsed,
                contextValue: 'appService',
                iconPath: {
                    light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', iconName),
                    dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', iconName)
                }
            }
        }
    }

    async getChildren(): Promise<NodeBase[]> {
        if (this.azureAccount.signInStatus !== 'LoggedIn') {
            return [];
        }

        const treeDataProvider = this.getTreeDataProvider<AppServiceDataProvider>();

        // https://github.com/Microsoft/vscode-azureappservice/issues/45
        return [
            new DeploymentSlotsNode(this.site, this.subscription, treeDataProvider, this),
            // new FilesNode('Files', '/site/wwwroot', this.site, this.subscription),
            // new FilesNode('Log Files', '/LogFiles', this.site, this.subscription),
            new WebJobsNode(this.site, this.subscription, treeDataProvider, this),
            new AppSettingsNode(this.site, this.subscription, treeDataProvider, this)
        ];
    }

    async start(): Promise<void> {
        await this.getWebSiteManagementClient(this.azureAccount).webApps.start(this.site.resourceGroup, this.site.name);
        return util.waitForWebSiteState(this.getWebSiteManagementClient(this.azureAccount), this.site, 'running');
    }

    async stop(): Promise<void> {
        await this.getWebSiteManagementClient(this.azureAccount).webApps.stop(this.site.resourceGroup, this.site.name);
        return util.waitForWebSiteState(this.getWebSiteManagementClient(this.azureAccount), this.site, 'stopped');
    }

    async restart(): Promise<void> {
        await this.stop();
        return this.start();
    }

    private getWebSiteManagementClient(azureAccount: AzureAccountWrapper) {
        return new WebSiteManagementClient(azureAccount.getCredentialByTenantId(this.subscription.tenantId), this.subscription.subscriptionId);
    }
}

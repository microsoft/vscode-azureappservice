/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter, Event, window, MessageItem, MessageOptions } from 'vscode';
import { AzureAccountWrapper } from '../azureAccountWrapper';
import { SubscriptionModels } from 'azure-arm-resource';
import * as WebSiteModels from '../../node_modules/azure-arm-website/lib/models';
import { AppServiceDataProvider } from './appServiceExplorer';
import { NodeBase } from './nodeBase';
import { DeploymentSlotNode } from './deploymentSlotNode';
import { DeploymentSlotsNode } from './deploymentSlotsNode';
import { FilesNode } from './filesNodes';
import { WebJobsNode } from './webJobsNode';
import { AppSettingsNode } from './appSettingsNodes';
import WebSiteManagementClient = require('azure-arm-website');
import * as path from 'path';
import * as opn from 'opn';
import * as util from '../util';

export type ServerFarmId = {
    subscriptions: string,
    resourceGroups: string,
    providers: string,
    serverfarms: string
}

export class AppServiceNode extends NodeBase {
    constructor(readonly site: WebSiteModels.Site, readonly subscription: SubscriptionModels.Subscription, treeDataProvider: AppServiceDataProvider, parentNode: NodeBase) {
        super(site.name, treeDataProvider, parentNode);
    }

    getTreeItem(): TreeItem {
        if (!this.site.kind.startsWith('functionapp')) {
            let iconName = 'AzureWebsite_16x_vscode.svg';
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

    browse(): void {
        const defaultHostName = this.site.defaultHostName;
        const isSsl = this.site.hostNameSslStates.findIndex((value, index, arr) =>
            value.name === defaultHostName && value.sslState === "Enabled");
        const uri = `${isSsl ? 'https://' : 'http://'}${defaultHostName}`;
        opn(uri);
    }

    openInPortal(): void {
        const portalEndpoint = 'https://portal.azure.com';
        const deepLink = `${portalEndpoint}/${this.subscription.tenantId}/#resource${this.site.id}`;
        opn(deepLink);
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
        await this.start();
    }

    async delete(azureAccount: AzureAccountWrapper): Promise<boolean> {

        let serverFarmArr = this.site.serverFarmId.substring(1).split('/');
        if (serverFarmArr.length % 2 !== 0) {
            throw new Error('Invalid web app ID.');
        }
        let serverFarmId: ServerFarmId = {
            subscriptions: serverFarmArr[1],
            resourceGroups: serverFarmArr[3],
            providers: serverFarmArr[5],
            serverfarms: serverFarmArr[7]
        };

        let servicePlan = await this.getWebSiteManagementClient(azureAccount).appServicePlans.get(serverFarmId.resourceGroups, serverFarmId.serverfarms);
        let mOptions: MessageOptions = { modal: true };
        let deleteServicePlan = false;
        let input = await window.showWarningMessage(`Are you sure you want to delete "${this.site.name}"?`, mOptions, 'Yes');
        if (input) {
            if (servicePlan.numberOfSites < 2) {
                let input = await window.showWarningMessage(`This is the last app in the App Service plan, "${serverFarmId.serverfarms}". Delete this App Service plan to prevent unexpected charges.`, mOptions, 'Yes', 'No');
                if (input) {
                    deleteServicePlan = input === 'Yes';
                } else {
                    return false;
                }
            }
            await this.getWebSiteManagementClient(azureAccount).webApps.deleteMethod(this.site.resourceGroup, this.site.name, { deleteEmptyServerFarm: deleteServicePlan });
            return true;
        }

        return false;
    }

    private get azureAccount(): AzureAccountWrapper {
        return this.getTreeDataProvider<AppServiceDataProvider>().azureAccount;
    }

    private getWebSiteManagementClient(azureAccount: AzureAccountWrapper) {
        return new WebSiteManagementClient(azureAccount.getCredentialByTenantId(this.subscription.tenantId), this.subscription.subscriptionId);
    }
}

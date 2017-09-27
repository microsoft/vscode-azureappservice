/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter, Event, workspace, window } from 'vscode';
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
            // new FilesNode('Files', '/site/wwwroot', this.site, this.subscription, treeDataProvider, this),
            // new FilesNode('Log Files', '/LogFiles', this.site, this.subscription),
            new WebJobsNode(this.site, this.subscription, treeDataProvider, this),
            new AppSettingsNode(this.site, this.subscription, treeDataProvider, this)
        ];
    }

    async start(): Promise<void> {
        await this.webSiteClient.webApps.start(this.site.resourceGroup, this.site.name);
        await util.waitForWebSiteState(this.webSiteClient, this.site, 'running');
    }

    async stop(): Promise<void> {
        await this.webSiteClient.webApps.stop(this.site.resourceGroup, this.site.name);
        await util.waitForWebSiteState(this.webSiteClient, this.site, 'stopped');
    }

    async restart(): Promise<void> {
        await this.stop();
        return this.start();
    }

    private get azureAccount(): AzureAccountWrapper {
        return this.getTreeDataProvider<AppServiceDataProvider>().azureAccount;
    }

    async localGitDeploy(azureAccount): Promise<boolean> {
        const publishCredentials = await this.getWebSiteManagementClient(azureAccount).webApps.listPublishingCredentials(this.site.resourceGroup, this.site.name);
        const config = await this.getWebSiteManagementClient(azureAccount).webApps.getConfiguration(this.site.resourceGroup, this.site.name);
        const oldDeployment = await this.getWebSiteManagementClient(azureAccount).webApps.listDeployments(this.site.resourceGroup, this.site.name);
        if (config.scmType !== 'LocalGit') {
            let input = await window.showErrorMessage(`Local Git Deployment is not set up. Set it up in the Azure Portal.`, `Go to Portal`)
            if (input === 'Go to Portal') {
                this.openInPortal();
            }
            return;
        }

        const username = publishCredentials.publishingUserName;
        const password = publishCredentials.publishingPassword;
        const repo = `${this.site.enabledHostNames[1]}:443/${this.site.repositorySiteName}.git`;
        const remote = `https://${username}:${password}@${repo}`;

        let git = require('simple-git/promise')(workspace.rootPath);

        try {
            await git.init()
            await git.push(remote, 'master')
        }
        catch (err) {
            if (err.message.indexOf('spawn git ENOENT') >= 0) {
                let input = await window.showErrorMessage(`Git must be installed to use Local Git Deploy.`, `Install`)
                if (input === 'Install') {
                    opn(`https://git-scm.com/downloads`);
                }
                return;
            } else if (err.message.indexOf('error: failed to push') >= 0) {
                let input = await window.showErrorMessage(`Push rejected due to Git history diverging. Force push?`, `Yes`)
                if (input === 'Yes') {
                    await git.push(['-f', remote, 'master']);
                } else {
                    return;
                }
            }
        }

        const newDeployment = await this.getWebSiteManagementClient(azureAccount).webApps.listDeployments(this.site.resourceGroup, this.site.name);
        if (newDeployment[0].deploymentId === oldDeployment[0].deploymentId) {
            await window.showWarningMessage(`Local Git repo is current with "${repo}".`);
            return;
        }
        return true;

    }

    private getWebSiteManagementClient(azureAccount: AzureAccountWrapper) {
        return new WebSiteManagementClient(azureAccount.getCredentialByTenantId(this.subscription.tenantId), this.subscription.subscriptionId);
    }
}


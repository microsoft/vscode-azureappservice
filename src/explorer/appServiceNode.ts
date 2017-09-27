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
import { DeploymentSlotNode } from './deploymentSlotNode';
import { DeploymentSlotsNode } from './deploymentSlotsNode';
import { FilesNode } from './filesNodes';
import { WebJobsNode } from './webJobsNode';
import { AppSettingsNode } from './appSettingsNodes';
import WebSiteManagementClient = require('azure-arm-website');
import * as path from 'path';
import * as opn from 'opn';
import * as util from '../util';

export class AppServiceNode extends NodeBase {
    constructor(readonly site: WebSiteModels.Site, readonly subscription: SubscriptionModels.Subscription, treeDataProvider: AppServiceDataProvider, parentNode: NodeBase) {
        super(site.name, treeDataProvider, parentNode);
    }

    getTreeItem(): TreeItem {
        if (!this.site.kind.startsWith('functionapp')) {
            let iconName =  'AzureWebsite_16x_vscode.svg';
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
            await window.showErrorMessage(`Local Git Deployment is not set up. Set it up in the Azure Portal.`, `Go to Portal`)
            .then(input => {
                if (input === 'Go to Portal') {
                    const deepLink = `https://ms.portal.azure.com/#resource${config.id.substring(0, config.id.indexOf('/config/web'))}/DeploymentSource`
                    opn(deepLink);   
                }
            });
            return;
        }

        const username = publishCredentials.publishingUserName;
        const password = publishCredentials.publishingPassword;
        const repo = `${this.site.enabledHostNames[1]}:443/${this.site.repositorySiteName}.git`;
        const remote = `https://${username}:${password}@${repo}`;
    
        let git = require('simple-git/promise')(workspace.rootPath);
        
        git.init()
        .catch(async err => {
            await window.showErrorMessage(`Git must be installed to use Local Git Deploy.`, `Install`) 
            .then(input => {
                if (input === 'Install') {
                    opn(`https://git-scm.com/downloads`);
                }
            });
            return;
        })
        git.add('./*');
        git.commit('Deployed through VS Code')
        git.push(['-f', remote, 'master'])
        .then(async (err, res) => {
            const newDeployments =  await this.getWebSiteManagementClient(azureAccount).webApps.listDeployments(this.site.resourceGroup, this.site.name);
            // weird logic here
            if (newDeployments[0] === oldDeployment[0]) {
                console.log(`it's not a new deployment`)
                await window.showWarningMessage(`No new commit to deploy to Local Git, "${repo}"`);
                return;
            }
            return true;
        })
    }

    private getWebSiteManagementClient(azureAccount: AzureAccountWrapper) {
        return new WebSiteManagementClient(azureAccount.getCredentialByTenantId(this.subscription.tenantId), this.subscription.subscriptionId);
    }
}


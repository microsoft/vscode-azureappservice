/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WebSiteModels from '../../node_modules/azure-arm-website/lib/models';
import * as opn from 'opn';
import * as path from 'path';
import * as util from '../util';
import WebSiteManagementClient = require('azure-arm-website');
import { NodeBase } from './nodeBase';
import { AppSettingsNode } from './appSettingsNodes';
import { AppServiceDataProvider } from './appServiceExplorer';
import { SubscriptionModels } from 'azure-arm-resource';
import { ExtensionContext, TreeDataProvider, TreeItem, OutputChannel, window, workspace, MessageItem, MessageOptions, commands } from 'vscode';
import { AzureAccountWrapper } from '../azureAccountWrapper';
import { KuduClient } from '../kuduClient';
import { Request } from 'request';
import { UserCancelledError } from '../errors';

export type ServerFarmId = {
    subscriptions: string,
    resourceGroups: string,
    providers: string,
    serverfarms: string
}

export class SiteNodeBase extends NodeBase {
    private _logStreamOutputChannel: OutputChannel;
    private _logStream: Request;

    constructor(readonly label: string,
        readonly site: WebSiteModels.Site,
        readonly subscription: SubscriptionModels.Subscription,
        treeDataProvider: AppServiceDataProvider,
        parentNode: NodeBase) {
        super(label, treeDataProvider, parentNode);
    }

    protected get azureAccount(): AzureAccountWrapper {
        return this.getTreeDataProvider<AppServiceDataProvider>().azureAccount;
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
        const rgName = this.site.resourceGroup;
        const siteName = util.extractSiteName(this.site);

        if (util.isSiteDeploymentSlot(this.site)) {
            const slotName = util.extractDeploymentSlotName(this.site);
            await this.webSiteClient.webApps.startSlot(rgName, siteName, slotName);
        } else {
            await this.webSiteClient.webApps.start(rgName, siteName);
        }
        await util.waitForWebSiteState(this.webSiteClient, this.site, 'running');
    }

    async stop(): Promise<void> {
        const rgName = this.site.resourceGroup;
        const siteName = util.extractSiteName(this.site);

        if (util.isSiteDeploymentSlot(this.site)) {
            const slotName = util.extractDeploymentSlotName(this.site);
            await this.webSiteClient.webApps.stopSlot(rgName, siteName, slotName);
        } else {
            await this.webSiteClient.webApps.stop(rgName, siteName);
        }
        await util.waitForWebSiteState(this.webSiteClient, this.site, 'stopped');
    }

    async restart(): Promise<void> {
        await this.stop();
        await this.start();
    }

    async delete(azureAccount: AzureAccountWrapper): Promise<void> {
        let mOptions: MessageOptions = { modal: true };
        let deleteServicePlan = false;
        let servicePlan;
        let serverFarmId: ServerFarmId;

        if (!util.isSiteDeploymentSlot(this.site)) {
            // API calls not necessary for deployment slots
            let serverFarmArr = this.site.serverFarmId.substring(1).split('/');
            if (serverFarmArr.length % 2 !== 0) {
                throw new Error('Invalid web app ID.');
            }
            serverFarmId = {
                subscriptions: serverFarmArr[1],
                resourceGroups: serverFarmArr[3],
                providers: serverFarmArr[5],
                serverfarms: serverFarmArr[7]
            };
            servicePlan = await this.webSiteClient.appServicePlans.get(serverFarmId.resourceGroups, serverFarmId.serverfarms);
        }

        let input = await window.showWarningMessage(`Are you sure you want to delete "${this.site.name}"?`, mOptions, 'Yes');
        if (input) {
            if (!util.isSiteDeploymentSlot(this.site) && servicePlan.numberOfSites < 2) {
                let input = await window.showWarningMessage(`This is the last app in the App Service plan, "${serverFarmId.serverfarms}". Delete this App Service plan to prevent unexpected charges.`, mOptions, 'Yes', 'No');
                if (input) {
                    deleteServicePlan = input === 'Yes';
                } else {
                    throw new UserCancelledError();
                }
            }
            await !util.isSiteDeploymentSlot(this.site) ?
                this.webSiteClient.webApps.deleteMethod(this.site.resourceGroup, this.site.name, { deleteEmptyServerFarm: deleteServicePlan }) :
                this.webSiteClient.webApps.deleteSlot(this.site.resourceGroup, util.extractSiteName(this.site), util.extractDeploymentSlotName(this.site));
            return;
        }

        throw new UserCancelledError();
    }

    async connectToLogStream(extensionContext: ExtensionContext): Promise<void> {
        const siteName = util.extractSiteName(this.site) + (util.isSiteDeploymentSlot(this.site) ? '-' + util.extractDeploymentSlotName(this.site) : '');
        const user = await util.getWebAppPublishCredential(this.webSiteClient, this.site);
        const kuduClient = new KuduClient(siteName, user.publishingUserName, user.publishingPassword);

        if (!this._logStreamOutputChannel) {
            this._logStreamOutputChannel = window.createOutputChannel(`${siteName} - Log Stream`);
            extensionContext.subscriptions.push(this._logStreamOutputChannel);
        }

        this._logStreamOutputChannel.appendLine('Connecting to log-streaming service...')
        this._logStreamOutputChannel.show();

        this.stopLogStream();

        this._logStream = kuduClient.getLogStream().on('data', chunk => {
            this._logStreamOutputChannel.append(chunk.toString());
        }).on('error', err => {
            util.sendTelemetry('ConnectToLogStreamError', { name: err.name, message: err.message });
            this._logStreamOutputChannel.appendLine('Error connecting to log-streaming service:');
            this._logStreamOutputChannel.appendLine(err.message);
        }).on('complete', (resp, body) => {
            this._logStreamOutputChannel.appendLine('Disconnected from log-streaming service.');
        });
    }

    stopLogStream(): void {
        if (this._logStream) {
            this._logStream.removeAllListeners();
            this._logStream.destroy();
            this._logStream = null;

            if (this._logStreamOutputChannel) {
                this._logStreamOutputChannel.appendLine('Disconnected from log-streaming service.');
            }
        }
    }

    async localGitDeploy(): Promise<boolean> {

        if (!workspace.rootPath) {
            let input = await window.showErrorMessage(`You have not yet opened a folder to deploy.`);
            throw new Error('No open workspace');
        }

        const siteName = util.extractSiteName(this.site);
        const isSlot = util.isSiteDeploymentSlot(this.site);
        const publishCredentials = !isSlot ?
            await this.webSiteClient.webApps.listPublishingCredentials(this.site.resourceGroup, siteName) :
            await this.webSiteClient.webApps.listPublishingCredentialsSlot(this.site.resourceGroup, siteName, util.extractDeploymentSlotName(this.site));
        const config = !isSlot ?
            await this.webSiteClient.webApps.getConfiguration(this.site.resourceGroup, siteName) :
            await this.webSiteClient.webApps.getConfigurationSlot(this.site.resourceGroup, siteName, util.extractDeploymentSlotName(this.site));
        const oldDeployment = !isSlot ?
            await this.webSiteClient.webApps.listDeployments(this.site.resourceGroup, siteName) :
            await this.webSiteClient.webApps.listDeploymentsSlot(this.site.resourceGroup, siteName, util.extractDeploymentSlotName(this.site));

        if (config.scmType !== 'LocalGit') {
            let input;
            let oldScmType = config.scmType;
            let updateConfig = config;
            updateConfig.scmType = 'LocalGit';

            if (oldScmType !== 'None') {
                input = await window.showWarningMessage(`Deployment source for "${siteName}" is set as "${oldScmType}".  Change to "LocalGit"?`, 'Yes');
            }

            if (oldScmType === 'None' || input === 'Yes') {
                !isSlot ?
                    await this.webSiteClient.webApps.updateConfiguration(this.site.resourceGroup, siteName, updateConfig) :
                    await this.webSiteClient.webApps.updateConfigurationSlot(this.site.resourceGroup, siteName, updateConfig, util.extractDeploymentSlotName(this.site));
            } else {
                throw new UserCancelledError();
            }
        }

        const username = publishCredentials.publishingUserName;
        const password = publishCredentials.publishingPassword;
        const repo = `${this.site.enabledHostNames[1]}:443/${this.site.repositorySiteName}.git`;
        const remote = `https://${username}:${password}@${repo}`;


        let git = require('simple-git/promise')(workspace.rootPath);

        try {
            let status = await git.status();
            if (status.files.length > 0) {
                window.showWarningMessage(`There ${status.files.length > 1 ? 'are' : 'is'} ${status.files.length} uncommitted change${status.files.length > 1 ? 's' : ''} in local repo "${workspace.rootPath}"`);
            }

            await git.push(remote, 'master');
        }
        catch (err) {
            if (err.message.indexOf('spawn git ENOENT') >= 0) {
                let input = await window.showErrorMessage(`Git must be installed to use Local Git Deploy.`, `Install`)
                if (input === 'Install') {
                    opn(`https://git-scm.com/downloads`);
                }
                throw err;
            } else if (err.message.indexOf('error: failed to push') >= 0) {
                let input = await window.showErrorMessage(`Push rejected due to Git history diverging. Force push?`, `Yes`)
                if (input === 'Yes') {
                    await git.push(['-f', remote, 'master']);
                } else {
                    throw err;
                }
            } else {
                throw err;
            }
        }

        const newDeployment = !util.isSiteDeploymentSlot(this.site) ?
            await this.webSiteClient.webApps.listDeployments(this.site.resourceGroup, this.site.name) :
            await this.webSiteClient.webApps.listDeploymentsSlot(this.site.resourceGroup, util.extractSiteName(this.site), util.extractDeploymentSlotName(this.site));

        if (newDeployment[0].deploymentId === oldDeployment[0].deploymentId) {
            await window.showErrorMessage(`Local Git repo is current with "${repo}".`);
            throw new Error(`Local Git repo is current with "${repo}".`);
        }
        return true;

    }

    protected get webSiteClient(): WebSiteManagementClient {
        return new WebSiteManagementClient(this.azureAccount.getCredentialByTenantId(this.subscription.tenantId), this.subscription.subscriptionId);
    }
}
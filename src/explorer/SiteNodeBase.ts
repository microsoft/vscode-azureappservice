/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SubscriptionModels } from 'azure-arm-resource';
import WebSiteManagementClient = require('azure-arm-website');
import * as opn from 'opn';
import { Request } from 'request';
import { ExtensionContext, OutputChannel, window } from 'vscode';
import { SiteWrapper } from 'vscode-azureappservice';
import * as WebSiteModels from '../../node_modules/azure-arm-website/lib/models';
import { AzureAccountWrapper } from '../AzureAccountWrapper';
import { GitNotInstalledError, LocalGitDeployError, UserCancelledError } from '../errors';
import { KuduClient } from '../KuduClient';
import * as util from '../util';
import { AppServiceDataProvider } from './AppServiceExplorer';
import { NodeBase } from './NodeBase';

export class SiteNodeBase extends NodeBase {
    private readonly _site: WebSiteModels.Site;
    private readonly _subscription: SubscriptionModels.Subscription;
    private _logStreamOutputChannel: OutputChannel | undefined;
    private _logStream: Request | undefined;
    private readonly _siteName: string;
    private readonly _isSlot: boolean;
    private readonly _slotName: string;
    private readonly _siteWrapper: SiteWrapper;

    public get site(): WebSiteModels.Site {
        return this._site;
    }

    public get subscription(): SubscriptionModels.Subscription {
        return this._subscription;
    }
    constructor(
        label: string,
        site: WebSiteModels.Site,
        subscription: SubscriptionModels.Subscription,
        treeDataProvider: AppServiceDataProvider,
        parentNode: NodeBase) {
        super(label, treeDataProvider, parentNode);

        this._site = site;
        this._subscription = subscription;
        this._siteName = util.extractSiteName(site);
        this._isSlot = util.isSiteDeploymentSlot(site);
        this._slotName = util.extractDeploymentSlotName(site);
        this._siteWrapper = new SiteWrapper(site);
    }

    protected get azureAccount(): AzureAccountWrapper {
        return this.getTreeDataProvider<AppServiceDataProvider>().azureAccount;
    }

    public browse(): void {
        const defaultHostName = this.site.defaultHostName;
        const isSsl = this.site.hostNameSslStates.findIndex(value =>
            value.name === defaultHostName && value.sslState === `Enabled`);
        // tslint:disable-next-line:no-http-string
        const uri = `${isSsl ? 'https://' : 'http://'}${defaultHostName}`;
        opn(uri);
    }

    public openInPortal(): void {
        const portalEndpoint = 'https://portal.azure.com';
        const deepLink = `${portalEndpoint}/${this.subscription.tenantId}/#resource${this.site.id}`;
        opn(deepLink);
    }

    public async start(): Promise<void> {
        await this._siteWrapper.start(this.webSiteClient);
    }

    public async stop(): Promise<void> {
        await this._siteWrapper.stop(this.webSiteClient);
    }

    public async restart(): Promise<void> {
        await this.stop();
        await this.start();
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async delete(): Promise<void> {
        let deleteServicePlan = false;
        let servicePlan;

        if (!this._isSlot) {
            // API calls not necessary for deployment slots
            servicePlan = await this.getAppServicePlan();
        }

        if (!util.isSiteDeploymentSlot(this.site) && servicePlan.numberOfSites < 2) {
            const input = await window.showWarningMessage(`This is the last app in the App Service plan "${servicePlan.name}". Do you want to delete this App Service plan to prevent unexpected charges?`, 'Yes', 'No');
            if (input) {
                deleteServicePlan = input === 'Yes';
            } else {
                throw new UserCancelledError();
            }
        }

        if (!this._isSlot) {
            await this.webSiteClient.webApps.deleteMethod(this.site.resourceGroup, this._siteName, { deleteEmptyServerFarm: deleteServicePlan });
        } else {
            await this.webSiteClient.webApps.deleteSlot(this.site.resourceGroup, this._siteName, this._slotName);
        }
    }

    public async isHttpLogsEnabled(): Promise<boolean> {
        const logsConfig = this._isSlot ? await this.webSiteClient.webApps.getDiagnosticLogsConfigurationSlot(this.site.resourceGroup, this._siteName, this._slotName) :
            await this.webSiteClient.webApps.getDiagnosticLogsConfiguration(this.site.resourceGroup, this._siteName);
        return logsConfig.httpLogs && logsConfig.httpLogs.fileSystem && logsConfig.httpLogs.fileSystem.enabled;
    }

    public async enableHttpLogs(): Promise<void> {
        const logsConfig: WebSiteModels.SiteLogsConfig = {
            location: this.site.location,
            httpLogs: {
                fileSystem: {
                    enabled: true,
                    retentionInDays: 7,
                    retentionInMb: 35
                }
            }
        };

        if (this._isSlot) {
            await this.webSiteClient.webApps.updateDiagnosticLogsConfigSlot(this.site.resourceGroup, this._siteName, logsConfig, this._slotName);
        } else {
            await this.webSiteClient.webApps.updateDiagnosticLogsConfig(this.site.resourceGroup, this._siteName, logsConfig);
        }
    }

    public async connectToLogStream(extensionContext: ExtensionContext): Promise<void> {
        const siteName = this._isSlot ? `${this._siteName}-${this._slotName}` : this._siteName;
        const user = await util.getWebAppPublishCredential(this.webSiteClient, this.site);
        const kuduClient = new KuduClient(siteName, user.publishingUserName, user.publishingPassword);

        if (!this._logStreamOutputChannel) {
            this._logStreamOutputChannel = window.createOutputChannel(`${siteName} - Log Stream`);
            extensionContext.subscriptions.push(this._logStreamOutputChannel);
        }

        this.stopLogStream();
        this._logStreamOutputChannel.appendLine('Connecting to log-streaming service...');
        this._logStreamOutputChannel.show();

        this._logStream = kuduClient.getLogStream().on('data', chunk => {
            this._logStreamOutputChannel.append(chunk.toString());
        }).on('error', err => {
            util.sendTelemetry('ConnectToLogStreamError', { name: err.name, message: err.message });
            this._logStreamOutputChannel.appendLine('Error connecting to log-streaming service:');
            this._logStreamOutputChannel.appendLine(err.message);
        }).on('complete', () => {
            this._logStreamOutputChannel.appendLine('Disconnected from log-streaming service.');
        });
    }

    public stopLogStream(): void {
        if (this._logStream) {
            this._logStream.removeAllListeners();
            this._logStream.destroy();
            this._logStream = undefined;

            if (this._logStreamOutputChannel) {
                this._logStreamOutputChannel.appendLine('Disconnected from log-streaming service.');
            }
        }
    }

    public async localGitDeploy(): Promise<void> {
        const fsWorkspaceFolder = await util.showWorkspaceFoldersQuickPick('Select the folder to Local Git deploy.');
        let taskResults: [WebSiteModels.User, WebSiteModels.SiteConfigResource, WebSiteModels.DeploymentCollection];
        if (!this._isSlot) {
            taskResults = await Promise.all([
                this.webSiteClient.webApps.listPublishingCredentials(this.site.resourceGroup, this._siteName),
                this.webSiteClient.webApps.getConfiguration(this.site.resourceGroup, this._siteName),
                this.webSiteClient.webApps.listDeployments(this.site.resourceGroup, this._siteName)
            ]);
        } else {
            taskResults = await Promise.all([
                this.webSiteClient.webApps.listPublishingCredentialsSlot(this.site.resourceGroup, this._siteName, util.extractDeploymentSlotName(this.site)),
                this.webSiteClient.webApps.getConfigurationSlot(this.site.resourceGroup, this._siteName, util.extractDeploymentSlotName(this.site)),
                this.webSiteClient.webApps.listDeploymentsSlot(this.site.resourceGroup, this._siteName, util.extractDeploymentSlotName(this.site))
            ]);
        }

        const publishCredentials = taskResults[0];
        const config = taskResults[1];
        const oldDeployment = taskResults[2];

        if (config.scmType !== 'LocalGit') {
            await this.updateScmType(this, config);
        }
        const username = publishCredentials.publishingUserName;
        const password = publishCredentials.publishingPassword;
        const repo = `${this.site.enabledHostNames[1]}:443/${this.site.repositorySiteName}.git`;
        // the scm url lives in the 1 index of enabledHostNames, not 0
        const remote = `https://${username}:${password}@${repo}`;
        const git = require('simple-git/promise')(fsWorkspaceFolder.uri.fsPath);
        try {

            const status = await git.status();
            if (status.files.length > 0) {
                window.showWarningMessage(`${status.files.length} uncommitted change(s) in local repo "${fsWorkspaceFolder.uri.path}"`);
            }
            await git.push(remote, 'HEAD:master');
        } catch (err) {
            if (err.message.indexOf('spawn git ENOENT') >= 0) {
                throw new GitNotInstalledError();
            } else if (err.message.indexOf('error: failed to push') >= 0) {
                const input = await window.showErrorMessage(`Push rejected due to Git history diverging. Force push?`, `Yes`);
                if (input === 'Yes') {
                    await git.push(['-f', remote, 'HEAD:master']);
                } else {
                    throw new UserCancelledError();
                }
            } else {
                const servicePlan = await this.getAppServicePlan();
                throw new LocalGitDeployError(err, servicePlan.sku.size);
            }
        }

        await this.validateNewDeployment(oldDeployment, repo);
    }

    protected get webSiteClient(): WebSiteManagementClient {
        return new WebSiteManagementClient(this.azureAccount.getCredentialByTenantId(this.subscription.tenantId), this.subscription.subscriptionId);
    }

    protected async getAppServicePlan(): Promise<WebSiteModels.AppServicePlan> {
        const serverFarmId = util.parseAzureResourceId(this.site.serverFarmId.toLowerCase());
        return await this.webSiteClient.appServicePlans.get(serverFarmId.resourcegroups, serverFarmId.serverfarms);
    }

    private async updateScmType(node: SiteNodeBase, config: WebSiteModels.SiteConfigResource): Promise<void> {
        let input;
        const oldScmType = config.scmType;
        const updateConfig = config;
        updateConfig.scmType = 'LocalGit';
        input = await window.showWarningMessage(`Deployment source for "${node._siteName}" is set as "${oldScmType}".  Change to "LocalGit"?`, 'Yes');
        if (input === 'Yes') {
            !node._isSlot ?
                await this.webSiteClient.webApps.updateConfiguration(node.site.resourceGroup, node._siteName, updateConfig) :
                await this.webSiteClient.webApps.updateConfigurationSlot(node.site.resourceGroup, node._siteName, updateConfig, util.extractDeploymentSlotName(node.site));
        } else {
            throw new UserCancelledError();
        }
    }

    private async validateNewDeployment(oldDeployment: WebSiteModels.DeploymentCollection, repo: string): Promise<void> {
        const newDeployment = !this._isSlot ?
            await this.webSiteClient.webApps.listDeployments(this.site.resourceGroup, this._siteName) :
            await this.webSiteClient.webApps.listDeploymentsSlot(this.site.resourceGroup, this._siteName, util.extractDeploymentSlotName(this.site));
        // if the oldDeployment has a length of 0, then there has never been a deployment
        if (newDeployment.length && oldDeployment.length &&
            newDeployment[0].deploymentId === oldDeployment[0].deploymentId) {
            throw new Error(`Azure Remote Repo is current with ${repo}`);
        }
    }
}

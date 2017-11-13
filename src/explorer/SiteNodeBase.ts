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
import { SiteActionError, UserCancelledError } from '../errors';
import { KuduClient } from '../KuduClient';
import * as util from '../util';
import { getOutputChannel } from '../util';
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

    public async deleteSite(outputChannel: OutputChannel): Promise<void> {
        await this._siteWrapper.deleteSite(this.webSiteClient, outputChannel);
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
        try {
            // if it returns undefined, then the user canceled the deployment
            if (!await this._siteWrapper.localGitDeploy(fsWorkspaceFolder.uri.fsPath, this.webSiteClient, getOutputChannel())) {
                throw new UserCancelledError();
            }
        } catch (err) {
            const appServicePlan = await this.getAppServicePlan();
            throw new SiteActionError(err, appServicePlan.sku.size);
        }
    }

    protected get webSiteClient(): WebSiteManagementClient {
        return new WebSiteManagementClient(this.azureAccount.getCredentialByTenantId(this.subscription.tenantId), this.subscription.subscriptionId);
    }

    protected async getAppServicePlan(): Promise<WebSiteModels.AppServicePlan> {
        const serverFarmId = util.parseAzureResourceId(this.site.serverFarmId.toLowerCase());
        return await this.webSiteClient.appServicePlans.get(serverFarmId.resourcegroups, serverFarmId.serverfarms);
    }
}

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
import { ExtensionContext, TreeDataProvider, TreeItem, OutputChannel, window, MessageItem, MessageOptions } from 'vscode';
import { AzureAccountWrapper } from '../azureAccountWrapper';
import { KuduClient } from '../kuduClient';
import { Request } from 'request';

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

    async delete(azureAccount: AzureAccountWrapper): Promise<boolean> {
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
                    return false;
                }
            }
            await !util.isSiteDeploymentSlot(this.site) ?
                this.webSiteClient.webApps.deleteMethod(this.site.resourceGroup, this.site.name, { deleteEmptyServerFarm: deleteServicePlan }) :
                this.webSiteClient.webApps.deleteSlot(this.site.resourceGroup, util.extractSiteName(this.site), util.extractDeploymentSlotName(this.site));
            return true;
        }

        return false;
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

    protected get webSiteClient(): WebSiteManagementClient {
        return new WebSiteManagementClient(this.azureAccount.getCredentialByTenantId(this.subscription.tenantId), this.subscription.subscriptionId);
    }
}
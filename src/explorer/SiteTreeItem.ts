/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import WebSiteManagementClient = require('azure-arm-website');
import * as WebSiteModels from 'azure-arm-website/lib/models';
import * as opn from 'opn';
import { Request } from 'request';
import { ExtensionContext, OutputChannel, window } from 'vscode';
import { SiteWrapper } from 'vscode-azureappservice';
import { IAzureParentNode, IAzureParentTreeItem, IAzureTreeItem, UserCancelledError } from 'vscode-azureextensionui';
import { SiteActionError } from '../errors';
import { KuduClient } from '../KuduClient';
import * as util from '../util';
import { getOutputChannel } from '../util';
import { nodeUtils } from '../utils/nodeUtils';

export abstract class SiteTreeItem implements IAzureParentTreeItem {
    public abstract readonly label: string;
    public abstract contextValue: string;

    public readonly siteWrapper: SiteWrapper;

    private readonly _site: WebSiteModels.Site;
    private _logStreamOutputChannel: OutputChannel | undefined;
    private _logStream: Request | undefined;
    private readonly _siteName: string;
    private readonly _isSlot: boolean;
    private readonly _slotName: string;

    public get site(): WebSiteModels.Site {
        return this._site;
    }

    constructor(site: WebSiteModels.Site) {
        this._site = site;
        this._siteName = util.extractSiteName(site);
        this._isSlot = util.isSiteDeploymentSlot(site);
        this._slotName = util.extractDeploymentSlotName(site);
        this.siteWrapper = new SiteWrapper(site);
    }

    public hasMoreChildren(): boolean {
        return false;
    }

    public abstract loadMoreChildren(node: IAzureParentNode): Promise<IAzureTreeItem[]>;

    public get id(): string {
        return this.site.id;
    }

    public browse(): void {
        const defaultHostName = this.site.defaultHostName;
        const isSsl = this.site.hostNameSslStates.findIndex(value =>
            value.name === defaultHostName && value.sslState === `Enabled`);
        // tslint:disable-next-line:no-http-string
        const uri = `${isSsl ? 'https://' : 'http://'}${defaultHostName}`;
        opn(uri);
    }

    public async deleteTreeItem(node: IAzureParentNode): Promise<void> {
        await this.siteWrapper.deleteSite(nodeUtils.getWebSiteClient(node), util.getOutputChannel());
    }

    public async isHttpLogsEnabled(client: WebSiteManagementClient): Promise<boolean> {
        const logsConfig = this._isSlot ? await client.webApps.getDiagnosticLogsConfigurationSlot(this.site.resourceGroup, this._siteName, this._slotName) :
            await client.webApps.getDiagnosticLogsConfiguration(this.site.resourceGroup, this._siteName);
        return logsConfig.httpLogs && logsConfig.httpLogs.fileSystem && logsConfig.httpLogs.fileSystem.enabled;
    }

    public async enableHttpLogs(client: WebSiteManagementClient): Promise<void> {
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
            await client.webApps.updateDiagnosticLogsConfigSlot(this.site.resourceGroup, this._siteName, logsConfig, this._slotName);
        } else {
            await client.webApps.updateDiagnosticLogsConfig(this.site.resourceGroup, this._siteName, logsConfig);
        }
    }

    public async connectToLogStream(client: WebSiteManagementClient, extensionContext: ExtensionContext): Promise<void> {
        const siteName = this._isSlot ? `${this._siteName}-${this._slotName}` : this._siteName;
        const user = await util.getWebAppPublishCredential(client, this.site);
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

    public async localGitDeploy(client: WebSiteManagementClient): Promise<void> {
        const fsWorkspaceFolder = await util.showWorkspaceFoldersQuickPick('Select the folder to Local Git deploy.');
        try {
            // if it returns undefined, then the user canceled the deployment
            if (!await this.siteWrapper.localGitDeploy(fsWorkspaceFolder.uri.fsPath, client, getOutputChannel())) {
                throw new UserCancelledError();
            }
        } catch (err) {
            const appServicePlan = await getAppServicePlan(this.site, client);
            throw new SiteActionError(err, appServicePlan.sku.size);
        }
    }

    public async editScmType(client: WebSiteManagementClient): Promise<string> {
        const updatedScmType = await this.siteWrapper.editScmType(client);
        if (!updatedScmType) {
            throw new UserCancelledError();
        }

        return updatedScmType;

    }
}

export async function getAppServicePlan(site: WebSiteModels.Site, client: WebSiteManagementClient): Promise<WebSiteModels.AppServicePlan> {
    const serverFarmId = util.parseAzureResourceId(site.serverFarmId.toLowerCase());
    return await client.appServicePlans.get(serverFarmId.resourcegroups, serverFarmId.serverfarms);
}

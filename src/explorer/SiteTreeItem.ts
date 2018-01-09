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
import { IAzureParentNode, IAzureParentTreeItem, IAzureTreeItem } from 'vscode-azureextensionui';
import { KuduClient } from '../KuduClient';
import * as util from '../util';
import { nodeUtils } from '../utils/nodeUtils';

export abstract class SiteTreeItem implements IAzureParentTreeItem {
    public abstract contextValue: string;

    public readonly siteWrapper: SiteWrapper;

    private readonly _site: WebSiteModels.Site;
    private _logStreamOutputChannel: OutputChannel | undefined;
    private _logStream: Request | undefined;
    private _label: string;

    public get site(): WebSiteModels.Site {
        return this._site;
    }

    constructor(site: WebSiteModels.Site) {
        this._site = site;
        this.siteWrapper = new SiteWrapper(site);
        this._label = this.createLabel(site.state);
    }

    public get label(): string {
        return this._label;
    }

    public hasMoreChildren(): boolean {
        return false;
    }

    public abstract loadMoreChildren(node: IAzureParentNode): Promise<IAzureTreeItem[]>;

    public get id(): string {
        return this.site.id;
    }

    public async start(client: WebSiteManagementClient): Promise<void> {
        await this.siteWrapper.start(client);
        this._label = this.createLabel(await this.siteWrapper.getState(client));
    }

    public async stop(client: WebSiteManagementClient): Promise<void> {
        await this.siteWrapper.stop(client);
        this._label = this.createLabel(await this.siteWrapper.getState(client));
    }

    public async restart(client: WebSiteManagementClient): Promise<void> {
        await this.stop(client);
        await this.start(client);
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
        return await this.siteWrapper.isHttpLogsEnabled(client);
    }

    public async enableHttpLogs(client: WebSiteManagementClient): Promise<void> {
        await this.siteWrapper.enableHttpLogs(client);
    }

    public async connectToLogStream(client: WebSiteManagementClient, extensionContext: ExtensionContext): Promise<OutputChannel> {
        const siteName = this.siteWrapper.appName;
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

        return this._logStreamOutputChannel;
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

    public async editScmType(client: WebSiteManagementClient): Promise<string> {
        return await this.siteWrapper.editScmType(client);
    }

    private createLabel(state: string): string {
        return `${this.siteWrapper.slotName ? this.siteWrapper.slotName : this.siteWrapper.name}${state && state.toLowerCase() !== 'running' ? ` (${state})` : ''}`;
    }
}

export async function getAppServicePlan(site: WebSiteModels.Site, client: WebSiteManagementClient): Promise<WebSiteModels.AppServicePlan> {
    const serverFarmId = util.parseAzureResourceId(site.serverFarmId.toLowerCase());
    return await client.appServicePlans.get(serverFarmId.resourcegroups, serverFarmId.serverfarms);
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import WebSiteManagementClient = require('azure-arm-website');
import * as WebSiteModels from 'azure-arm-website/lib/models';
import * as opn from 'opn';
import { ExtensionContext, MessageItem, OutputChannel, window, workspace } from 'vscode';
import { ILogStream, SiteWrapper } from 'vscode-azureappservice';
import { IAzureNode, IAzureParentNode, IAzureParentTreeItem, IAzureTreeItem } from 'vscode-azureextensionui';
import KuduClient from 'vscode-azurekudu';
import TelemetryReporter from 'vscode-extension-telemetry';
import * as util from '../util';
import { nodeUtils } from '../utils/nodeUtils';

export abstract class SiteTreeItem implements IAzureParentTreeItem {
    public abstract contextValue: string;

    public readonly siteWrapper: SiteWrapper;
    public logStream: ILogStream | undefined;
    public logStreamOutputChannel: OutputChannel | undefined;

    private readonly _site: WebSiteModels.Site;
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
        const isSsl: boolean = this.site.hostNameSslStates.some(value =>
            value.name === defaultHostName && value.sslState === `Enabled`);
        // tslint:disable-next-line:no-http-string
        const uri = `${isSsl ? 'https://' : 'http://'}${defaultHostName}`;
        // tslint:disable-next-line:no-unsafe-any
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

    public async connectToLogStream(client: WebSiteManagementClient, reporter: TelemetryReporter, context: ExtensionContext): Promise<ILogStream> {
        const kuduClient: KuduClient = await this.siteWrapper.getKuduClient(client);
        if (!this.logStreamOutputChannel) {
            const logStreamoutputChannel: OutputChannel = window.createOutputChannel(`${this.siteWrapper.appName} - Log Stream`);
            context.subscriptions.push(logStreamoutputChannel);
            this.logStreamOutputChannel = logStreamoutputChannel;
        }
        return await this.siteWrapper.startStreamingLogs(kuduClient, reporter, this.logStreamOutputChannel);
    }

    public async editScmType(node: IAzureNode, outputChannel: OutputChannel): Promise<string> {
        return await this.siteWrapper.editScmType(node, outputChannel);
    }

    public async deploy(fsPath: string, client: WebSiteManagementClient, outputChannel: OutputChannel, configurationSectionName: string): Promise<void> {
        const siteConfig = await this.siteWrapper.getSiteConfig(client);
        if (siteConfig.scmType === 'None') {
            // check if web app is being zipdeployed
            await this.enableScmDoBuildDuringDeploy(client);
        }
        await this.siteWrapper.deploy(fsPath, client, outputChannel, configurationSectionName);
    }

    private async enableScmDoBuildDuringDeploy(client: WebSiteManagementClient): Promise<void> {
        const yesButton: MessageItem = { title: 'Yes' };
        const noButton: MessageItem = { title: 'No', isCloseAffordance: true };
        const appSettings: WebSiteModels.StringDictionary = await client.webApps.listApplicationSettings(this.siteWrapper.resourceGroup, this.siteWrapper.appName);
        if (!appSettings.properties.SCM_DO_BUILD_DURING_DEPLOYMENT) {
            // if the web app does not have the "SCM_DO_BUILD_DURING_DEPLOYMENT", then it will return "undefined"
            const buildDuringDeploy: string = "Run build script during deployment? Zipping all packages will cause a slower deployment.";
            if (await window.showInformationMessage(buildDuringDeploy, yesButton, noButton) === yesButton) {
                appSettings.properties.SCM_DO_BUILD_DURING_DEPLOYMENT = 'true';
                workspace.getConfiguration().update('appService.zipIgnorePattern', 'node_modules{,/**}');
                await client.webApps.updateApplicationSettings(this.siteWrapper.resourceGroup, this.siteWrapper.appName, appSettings);
            } else {
                appSettings.properties.SCM_DO_BUILD_DURING_DEPLOYMENT = 'false';
                await client.webApps.updateApplicationSettings(this.siteWrapper.resourceGroup, this.siteWrapper.appName, appSettings);
            }
        }
    }

    private createLabel(state: string): string {
        return (this.siteWrapper.slotName ? this.siteWrapper.slotName : this.siteWrapper.name) +    // Site/slot name
            (state && state.toLowerCase() !== 'running' ? ` (${state})` : '');  // Status (if site/slot not running)
    }
}

export async function getAppServicePlan(site: WebSiteModels.Site, client: WebSiteManagementClient): Promise<WebSiteModels.AppServicePlan> {
    const serverFarmId = util.parseAzureResourceId(site.serverFarmId.toLowerCase());
    return await client.appServicePlans.get(serverFarmId.resourcegroups, serverFarmId.serverfarms);
}

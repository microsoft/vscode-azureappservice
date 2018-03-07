/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import WebSiteManagementClient = require('azure-arm-website');
import * as WebSiteModels from 'azure-arm-website/lib/models';
import * as fse from 'fs-extra';
import * as opn from 'opn';
import * as path from 'path';
import { ExtensionContext, MessageItem, OutputChannel, Uri, window, workspace, WorkspaceConfiguration } from 'vscode';
import { ILogStream, SiteWrapper } from 'vscode-azureappservice';
import { IAzureNode, IAzureParentNode, IAzureParentTreeItem, IAzureTreeItem } from 'vscode-azureextensionui';
import KuduClient from 'vscode-azurekudu';
import TelemetryReporter from 'vscode-extension-telemetry';
import * as constants from '../constants';
import * as util from '../util';
import { nodeUtils } from '../utils/nodeUtils';
import { validateWebSite } from '../validateWebSite';

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
        const uri = this.defaultHostUri;
        // tslint:disable-next-line:no-unsafe-any
        opn(uri);
    }

    public get defaultHostUri(): string {
        const defaultHostName = this.site.defaultHostName;
        const isSsl: boolean = this.site.hostNameSslStates.some(value =>
            value.name === defaultHostName && value.sslState === `Enabled`);
        // tslint:disable-next-line:no-http-string
        return `${isSsl ? 'https://' : 'http://'}${defaultHostName}`;
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

    public async deploy(
        fsPath: string,
        client: WebSiteManagementClient,
        outputChannel: OutputChannel,
        telemetryReporter: TelemetryReporter,
        configurationSectionName: string,
        confirmDeployment: boolean = true
    ): Promise<void> {
        const workspaceConfig: WorkspaceConfiguration = workspace.getConfiguration(constants.extensionPrefix, Uri.file(fsPath));
        if (workspaceConfig.get(constants.configurationSettings.showBuildDuringDeployPrompt)) {
            const siteConfig: WebSiteModels.SiteConfigResource = await this.siteWrapper.getSiteConfig(client);
            if (siteConfig.linuxFxVersion.startsWith(constants.runtimes.node) && siteConfig.scmType === 'None' && !(await fse.pathExists(path.join(fsPath, constants.deploymentFileName)))) {
                // check if web app has node runtime, is being zipdeployed, and if there is no .deployment file
                // tslint:disable-next-line:no-unsafe-any
                await this.enableScmDoBuildDuringDeploy(fsPath, constants.runtimes[siteConfig.linuxFxVersion.substring(0, siteConfig.linuxFxVersion.indexOf('|'))]);
            }
        }
        await this.siteWrapper.deploy(fsPath, client, outputChannel, configurationSectionName, confirmDeployment);

        // Don't wait
        validateWebSite(this, outputChannel, telemetryReporter).then(
            () => {
                // ignore
            },
            () => {
                // ignore
            });
    }

    private async enableScmDoBuildDuringDeploy(fsPath: string, runtime: string): Promise<void> {
        const yesButton: MessageItem = { title: 'Yes' };
        const dontShowAgainButton: MessageItem = { title: "Don't show again", isCloseAffordance: true };
        const learnMoreButton: MessageItem = { title: 'Learn More' };
        const zipIgnoreFolders: string[] = constants.getIgnoredFoldersForDeployment(runtime);
        const buildDuringDeploy: string = `Run build script during deployment?  The "${zipIgnoreFolders.join(", ")}" directory will be built during the deployment, rather than zipped, resulting in a faster deployment.`;
        let input: MessageItem = learnMoreButton;
        while (input === learnMoreButton) {
            input = await window.showInformationMessage(buildDuringDeploy, yesButton, dontShowAgainButton, learnMoreButton);
            if (input === learnMoreButton) {
                // tslint:disable-next-line:no-unsafe-any
                opn('https://aka.ms/Kwwkbd');
            }
        }
        if (input === yesButton) {
            let oldSettings: string[] | string = workspace.getConfiguration(constants.extensionPrefix, Uri.file(fsPath)).get(constants.configurationSettings.zipIgnorePattern);
            if (typeof oldSettings === "string") {
                oldSettings = [oldSettings];
                // settings have to be an array to concat the proper zipIgnoreFolders
            }
            workspace.getConfiguration(constants.extensionPrefix, Uri.file(fsPath)).update(constants.configurationSettings.zipIgnorePattern, oldSettings.concat(zipIgnoreFolders));
            await fse.writeFile(path.join(fsPath, constants.deploymentFileName), constants.deploymentFile);
        } else if (input === dontShowAgainButton) {
            workspace.getConfiguration(constants.extensionPrefix, Uri.file(fsPath)).update(constants.configurationSettings.showBuildDuringDeployPrompt, false);
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

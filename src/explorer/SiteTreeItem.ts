/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WebSiteModels from 'azure-arm-website/lib/models';
import { randomBytes } from 'crypto';
import * as fse from 'fs-extra';
import * as opn from 'opn';
import * as path from 'path';
import { ExtensionContext, MessageItem, OutputChannel, Uri, window, workspace, WorkspaceConfiguration } from 'vscode';
import { deleteSite, ILogStream, SiteClient, startStreamingLogs } from 'vscode-azureappservice';
import * as appservice from 'vscode-azureappservice';
import { IAzureNode, IAzureParentNode, IAzureParentTreeItem, IAzureTreeItem, IAzureUserInput, TelemetryProperties } from 'vscode-azureextensionui';
import * as constants from '../constants';
import { ext } from '../extensionVariables';
import * as util from '../util';
import { cancelWebsiteValidation, validateWebSite } from '../validateWebSite';

export abstract class SiteTreeItem implements IAzureParentTreeItem {
    public abstract contextValue: string;

    public readonly client: SiteClient;
    public logStream: ILogStream | undefined;
    public logStreamOutputChannel: OutputChannel | undefined;

    private _state?: string;

    constructor(client: SiteClient) {
        this.client = client;
        this._state = client.initialState;
    }

    public get label(): string {
        // tslint:disable-next-line:no-non-null-assertion
        return this.client.isSlot ? this.client.slotName! : this.client.siteName;
    }

    public get description(): string | undefined {
        return this._state && this._state.toLowerCase() !== 'running' ? this._state : undefined;
    }

    public async refreshLabel(): Promise<void> {
        try {
            this._state = await this.client.getState();
        } catch {
            this._state = 'Unknown';
        }
    }

    public hasMoreChildren(): boolean {
        return false;
    }

    public abstract loadMoreChildren(node: IAzureParentNode): Promise<IAzureTreeItem[]>;

    public get id(): string {
        return this.client.id;
    }

    public browse(): void {
        // tslint:disable-next-line:no-unsafe-any
        opn(this.client.defaultHostUrl);
    }

    public async deleteTreeItem(node: IAzureNode): Promise<void> {
        await deleteSite(this.client, node.ui, util.getOutputChannel());
    }

    public async isHttpLogsEnabled(): Promise<boolean> {
        const logsConfig: WebSiteModels.SiteLogsConfig = await this.client.getLogsConfig();
        return !!(logsConfig.httpLogs && logsConfig.httpLogs.fileSystem && logsConfig.httpLogs.fileSystem.enabled);
    }

    public async enableHttpLogs(): Promise<void> {
        const logsConfig: WebSiteModels.SiteLogsConfig = {
            location: this.client.location,
            httpLogs: {
                fileSystem: {
                    enabled: true,
                    retentionInDays: 7,
                    retentionInMb: 35
                }
            }
        };

        await this.client.updateLogsConfig(logsConfig);
    }

    public async connectToLogStream(context: ExtensionContext): Promise<ILogStream> {
        if (!this.logStreamOutputChannel) {
            const logStreamoutputChannel: OutputChannel = window.createOutputChannel(`${this.client.fullName} - Log Stream`);
            context.subscriptions.push(logStreamoutputChannel);
            this.logStreamOutputChannel = logStreamoutputChannel;
        }
        this.logStreamOutputChannel.show();
        return await startStreamingLogs(this.client, ext.reporter, this.logStreamOutputChannel);
    }

    public async deploy(
        node: IAzureNode,
        fsPath: string | undefined,
        outputChannel: OutputChannel,
        ui: IAzureUserInput,
        configurationSectionName: string,
        confirmDeployment: boolean = true,
        telemetryProperties: TelemetryProperties
    ): Promise<void> {
        const correlationId = getRandomHexString(10);
        telemetryProperties.correlationId = correlationId;

        const siteConfig: WebSiteModels.SiteConfigResource = await this.client.getSiteConfig();
        let deploymentFilePath: string;
        if (fsPath) {
            deploymentFilePath = fsPath;
        } else {
            if (siteConfig.linuxFxVersion && siteConfig.linuxFxVersion.toLowerCase().startsWith('tomcat')) {
                deploymentFilePath = await util.showWarQuickPick('Select the war file to deploy...', telemetryProperties);
            } else {
                deploymentFilePath = await util.showWorkspaceFoldersQuickPick("Select the folder to deploy", telemetryProperties, constants.configurationSettings.deploySubpath);
            }
        }

        const workspaceConfig: WorkspaceConfiguration = workspace.getConfiguration(constants.extensionPrefix, Uri.file(deploymentFilePath));
        if (workspaceConfig.get(constants.configurationSettings.showBuildDuringDeployPrompt)) {
            if (siteConfig.linuxFxVersion && siteConfig.linuxFxVersion.startsWith(constants.runtimes.node) && siteConfig.scmType === 'None' && !(await fse.pathExists(path.join(deploymentFilePath, constants.deploymentFileName)))) {
                // check if web app has node runtime, is being zipdeployed, and if there is no .deployment file
                // tslint:disable-next-line:no-unsafe-any
                await this.enableScmDoBuildDuringDeploy(deploymentFilePath, constants.runtimes[siteConfig.linuxFxVersion.substring(0, siteConfig.linuxFxVersion.indexOf('|'))]);
            }
        }
        cancelWebsiteValidation(this);

        await node.runWithTemporaryDescription("Deploying...", async () => {
            await appservice.deploy(this.client, deploymentFilePath, outputChannel, ui, configurationSectionName, confirmDeployment, telemetryProperties);
        });

        // Don't wait
        validateWebSite(correlationId, this, outputChannel).then(
            () => {
                // ignore
            },
            () => {
                // ignore
            });
    }

    private async enableScmDoBuildDuringDeploy(fsPath: string, runtime: string): Promise<void> {
        const yesButton: MessageItem = { title: 'Yes' };
        const dontShowAgainButton: MessageItem = { title: "No, and don't show again" };
        const learnMoreButton: MessageItem = { title: 'Learn More' };
        const zipIgnoreFolders: string[] = constants.getIgnoredFoldersForDeployment(runtime);
        const buildDuringDeploy: string = `Would you like to configure your project for faster deployment?`;
        let input: MessageItem | undefined = learnMoreButton;
        while (input === learnMoreButton) {
            input = await window.showInformationMessage(buildDuringDeploy, yesButton, dontShowAgainButton, learnMoreButton);
            if (input === learnMoreButton) {
                // tslint:disable-next-line:no-unsafe-any
                opn('https://aka.ms/Kwwkbd');
            }
        }
        if (input === yesButton) {
            let oldSettings: string[] | string | undefined = workspace.getConfiguration(constants.extensionPrefix, Uri.file(fsPath)).get(constants.configurationSettings.zipIgnorePattern);
            if (!oldSettings) {
                oldSettings = [];
            } else if (typeof oldSettings === "string") {
                oldSettings = [oldSettings];
                // settings have to be an array to concat the proper zipIgnoreFolders
            }
            workspace.getConfiguration(constants.extensionPrefix, Uri.file(fsPath)).update(constants.configurationSettings.zipIgnorePattern, oldSettings.concat(zipIgnoreFolders));
            await fse.writeFile(path.join(fsPath, constants.deploymentFileName), constants.deploymentFile);
        } else if (input === dontShowAgainButton) {
            workspace.getConfiguration(constants.extensionPrefix, Uri.file(fsPath)).update(constants.configurationSettings.showBuildDuringDeployPrompt, false);
        }
    }
}

function getRandomHexString(length: number): string {
    const buffer: Buffer = randomBytes(Math.ceil(length / 2));
    return buffer.toString('hex').slice(0, length);
}

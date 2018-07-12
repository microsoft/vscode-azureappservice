/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WebSiteModels from 'azure-arm-website/lib/models';
import * as fse from 'fs-extra';
import * as opn from 'opn';
import * as path from 'path';
import { MessageItem, OutputChannel, Uri, window, workspace, WorkspaceConfiguration } from 'vscode';
import { deleteSite, ILogStream, SiteClient, startStreamingLogs } from 'vscode-azureappservice';
import { DialogResponses, IAzureNode, IAzureParentNode, IAzureParentTreeItem, IAzureTreeItem, TelemetryProperties } from 'vscode-azureextensionui';
import * as constants from '../constants';
import { ext } from '../extensionVariables';

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

    public async deleteTreeItem(_node: IAzureNode): Promise<void> {
        await deleteSite(this.client);
    }

    public async isHttpLogsEnabled(): Promise<boolean> {
        const logsConfig: WebSiteModels.SiteLogsConfig = await this.client.getLogsConfig();
        return !!(logsConfig.httpLogs && logsConfig.httpLogs.fileSystem && logsConfig.httpLogs.fileSystem.enabled);
    }

    public async enableHttpLogs(): Promise<void> {
        const logsConfig: WebSiteModels.SiteLogsConfig = {
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

    public async connectToLogStream(): Promise<ILogStream> {
        if (!this.logStreamOutputChannel) {
            const logStreamoutputChannel: OutputChannel = window.createOutputChannel(`${this.client.fullName} - Log Stream`);
            ext.context.subscriptions.push(logStreamoutputChannel);
            this.logStreamOutputChannel = logStreamoutputChannel;
        }
        this.logStreamOutputChannel.show();
        return await startStreamingLogs(this.client, this.logStreamOutputChannel);
    }

    public async enableScmDoBuildDuringDeploy(fsPath: string, runtime: string, telemetryProperties: TelemetryProperties): Promise<void> {
        const yesButton: MessageItem = { title: 'Yes' };
        const dontShowAgainButton: MessageItem = { title: "No, and don't show again" };
        const learnMoreButton: MessageItem = { title: 'Learn More' };
        const zipIgnoreFolders: string[] = constants.getIgnoredFoldersForDeployment(runtime);
        const buildDuringDeploy: string = `Would you like to update your workspace configuration to run npm install on the target server? This should improve deployment performance.`;
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
            telemetryProperties.enableScmInput = "Yes";
        } else {
            workspace.getConfiguration(constants.extensionPrefix, Uri.file(fsPath)).update(constants.configurationSettings.showBuildDuringDeployPrompt, false);
            telemetryProperties.enableScmInput = "No, and don't show again";
        }

        if (!telemetryProperties.enableScmInput) {
            telemetryProperties.enableScmInput = "Canceled";
        }
    }

    public async promptToSaveDeployDefaults(node: IAzureNode<SiteTreeItem>, workspacePath: string, deployPath: string, telemetryProperties: TelemetryProperties): Promise<void> {
        const saveDeploymentConfig: string = `Always deploy the workspace "${path.basename(workspacePath)}" to "${node.treeItem.client.fullName}"?`;
        const dontShowAgain: MessageItem = { title: "Don't show again" };
        const workspaceConfiguration: WorkspaceConfiguration = workspace.getConfiguration(constants.extensionPrefix, Uri.file(deployPath));
        const result: MessageItem = await ext.ui.showWarningMessage(saveDeploymentConfig, DialogResponses.yes, dontShowAgain, DialogResponses.skipForNow);
        if (result === DialogResponses.yes) {
            workspaceConfiguration.update(constants.configurationSettings.defaultWebAppToDeploy, node.id);
            workspaceConfiguration.update(constants.configurationSettings.deploySubpath, path.relative(workspacePath, deployPath)); // '' is a falsey value
            telemetryProperties.promptToSaveDeployConfigs = 'Yes';
        } else if (result === dontShowAgain) {
            workspaceConfiguration.update(constants.configurationSettings.defaultWebAppToDeploy, constants.none);
            telemetryProperties.promptToSaveDeployConfigs = "Don't show again";
        } else {
            telemetryProperties.promptToSaveDeployConfigs = 'Skip for now';
        }
    }
}

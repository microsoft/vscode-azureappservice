/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WebSiteModels from 'azure-arm-website/lib/models';
import * as fse from 'fs-extra';
import * as opn from 'opn';
import * as path from 'path';
import { MessageItem, Uri, window, workspace, WorkspaceConfiguration } from 'vscode';
import { deleteSite, ISiteTreeRoot, SiteClient } from 'vscode-azureappservice';
import { AzureParentTreeItem, AzureTreeItem, DialogResponses, TelemetryProperties } from 'vscode-azureextensionui';
import * as constants from '../constants';
import { ext } from '../extensionVariables';

export abstract class SiteTreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public abstract contextValue: string;

    private readonly _root: ISiteTreeRoot;
    private _state?: string;

    constructor(parent: AzureParentTreeItem, client: SiteClient) {
        super(parent);
        this._root = Object.assign({}, parent.root, { client });
        this._state = client.initialState;
    }

    public get root(): ISiteTreeRoot {
        return this._root;
    }

    public get label(): string {
        // tslint:disable-next-line:no-non-null-assertion
        return this.root.client.isSlot ? this.root.client.slotName! : this.root.client.siteName;
    }

    public get description(): string | undefined {
        return this._state && this._state.toLowerCase() !== 'running' ? this._state : undefined;
    }

    public get logStreamLabel(): string {
        return this.root.client.fullName;
    }

    public async refreshLabel(): Promise<void> {
        try {
            this._state = await this.root.client.getState();
        } catch {
            this._state = 'Unknown';
        }
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public abstract loadMoreChildrenImpl(clearCache: boolean): Promise<AzureTreeItem<ISiteTreeRoot>[]>;

    public get id(): string {
        return this.root.client.id;
    }

    public browse(): void {
        // tslint:disable-next-line:no-unsafe-any
        opn(this.root.client.defaultHostUrl);
    }

    public async deleteTreeItemImpl(): Promise<void> {
        await deleteSite(this.root.client);
    }

    public async isHttpLogsEnabled(): Promise<boolean> {
        const logsConfig: WebSiteModels.SiteLogsConfig = await this.root.client.getLogsConfig();
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

        await this.root.client.updateLogsConfig(logsConfig);
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

    public async promptToSaveDeployDefaults(workspacePath: string, deployPath: string, telemetryProperties: TelemetryProperties): Promise<void> {
        const saveDeploymentConfig: string = `Always deploy the workspace "${path.basename(workspacePath)}" to "${this.root.client.fullName}"?`;
        const dontShowAgain: MessageItem = { title: "Don't show again" };
        const workspaceConfiguration: WorkspaceConfiguration = workspace.getConfiguration(constants.extensionPrefix, Uri.file(deployPath));
        const result: MessageItem = await ext.ui.showWarningMessage(saveDeploymentConfig, DialogResponses.yes, dontShowAgain, DialogResponses.skipForNow);
        if (result === DialogResponses.yes) {
            workspaceConfiguration.update(constants.configurationSettings.defaultWebAppToDeploy, this.fullId);
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

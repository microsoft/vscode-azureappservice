/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WebSiteModels from 'azure-arm-website/lib/models';
import * as fse from 'fs-extra';
import * as path from 'path';
import { MessageItem, Uri, window, workspace, WorkspaceConfiguration } from 'vscode';
import { AppSettingsTreeItem, AppSettingTreeItem, deleteSite, DeploymentsTreeItem, DeploymentTreeItem, ISiteTreeRoot, LinuxRuntimes, SiteClient } from 'vscode-azureappservice';
import { AzExtTreeItem, AzureParentTreeItem, AzureTreeItem, DialogResponses, IActionContext, TelemetryProperties } from 'vscode-azureextensionui';
import { deploy } from '../commands/deploy';
import { toggleValueVisibilityCommandId } from '../constants';
import * as constants from '../constants';
import { ext } from '../extensionVariables';
import { nonNullValue } from '../utils/nonNull';
import { openUrl } from '../utils/openUrl';
import { ConnectionsTreeItem } from './ConnectionsTreeItem';
import { CosmosDBConnection } from './CosmosDBConnection';
import { CosmosDBTreeItem } from './CosmosDBTreeItem';
import { FolderTreeItem } from './FolderTreeItem';
import { WebJobsTreeItem } from './WebJobsTreeItem';

export abstract class SiteTreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public readonly abstract contextValue: string;
    public readonly abstract label: string;

    public readonly appSettingsNode: AppSettingsTreeItem;
    public deploymentsNode: DeploymentsTreeItem | undefined;

    private readonly _connectionsNode: ConnectionsTreeItem;
    private readonly _folderNode: FolderTreeItem;
    private readonly _logFolderNode: FolderTreeItem;
    private readonly _webJobsNode: WebJobsTreeItem;

    private readonly _root: ISiteTreeRoot;
    private _state?: string;

    constructor(parent: AzureParentTreeItem, client: SiteClient) {
        super(parent);
        this._root = Object.assign({}, parent.root, { client });
        this._state = client.initialState;

        this.appSettingsNode = new AppSettingsTreeItem(this, toggleValueVisibilityCommandId);
        this._connectionsNode = new ConnectionsTreeItem(this);
        this._folderNode = new FolderTreeItem(this, 'Files', "/site/wwwroot");
        this._logFolderNode = new FolderTreeItem(this, 'Logs', '/LogFiles', 'logFolder');
        this._webJobsNode = new WebJobsTreeItem(this);
    }

    public get root(): ISiteTreeRoot {
        return this._root;
    }

    public get description(): string | undefined {
        return this._state && this._state.toLowerCase() !== 'running' ? this._state : undefined;
    }

    public get logStreamLabel(): string {
        return this.root.client.fullName;
    }

    public async refreshImpl(): Promise<void> {
        try {
            this._state = await this.root.client.getState();
        } catch {
            this._state = 'Unknown';
        }
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public get id(): string {
        return this.root.client.id;
    }

    public async browse(): Promise<void> {
        await openUrl(this.root.client.defaultHostUrl);
    }

    public async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzureTreeItem<ISiteTreeRoot>[]> {
        const siteConfig: WebSiteModels.SiteConfig = await this.root.client.getSiteConfig();
        const sourceControl: WebSiteModels.SiteSourceControl = await this.root.client.getSourceControl();
        this.deploymentsNode = new DeploymentsTreeItem(this, siteConfig, sourceControl, 'appService.ConnectToGitHub');
        return [this.appSettingsNode, this._connectionsNode, this.deploymentsNode, this._folderNode, this._logFolderNode, this._webJobsNode];
    }

    public async pickTreeItemImpl(expectedContextValues: (string | RegExp)[]): Promise<AzExtTreeItem | undefined> {
        for (const expectedContextValue of expectedContextValues) {
            switch (expectedContextValue) {
                case AppSettingsTreeItem.contextValue:
                case AppSettingTreeItem.contextValue:
                    return this.appSettingsNode;
                case ConnectionsTreeItem.contextValue:
                case CosmosDBTreeItem.contextValueInstalled:
                case CosmosDBTreeItem.contextValueNotInstalled:
                case CosmosDBConnection.contextValue:
                    return this._connectionsNode;
                case DeploymentsTreeItem.contextValueConnected:
                case DeploymentsTreeItem.contextValueUnconnected:
                case DeploymentTreeItem.contextValue:
                    return this.deploymentsNode;
                case FolderTreeItem.contextValue:
                    return this._folderNode;
                case WebJobsTreeItem.contextValue:
                    return this._webJobsNode;
                default:
                    if (typeof expectedContextValue === 'string' && DeploymentTreeItem.contextValue.test(expectedContextValue)) {
                        return this.deploymentsNode;
                    }
            }
        }

        return undefined;
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

    public async promptScmDoBuildDeploy(fsPath: string, runtime: string, telemetryProperties: TelemetryProperties): Promise<void> {
        const yesButton: MessageItem = { title: 'Yes' };
        const dontShowAgainButton: MessageItem = { title: "No, and don't show again" };
        const learnMoreButton: MessageItem = { title: 'Learn More' };
        const buildDuringDeploy: string = `Would you like to update your workspace configuration to run build commands on the target server? This should improve deployment performance.`;
        let input: MessageItem | undefined = learnMoreButton;
        while (input === learnMoreButton) {
            input = await window.showInformationMessage(buildDuringDeploy, yesButton, dontShowAgainButton, learnMoreButton);
            if (input === learnMoreButton) {
                await openUrl('https://aka.ms/Kwwkbd');
            }
        }
        if (input === yesButton) {
            await this.enableScmDoBuildDuringDeploy(fsPath, runtime);
            telemetryProperties.enableScmInput = "Yes";
        } else {
            workspace.getConfiguration(constants.extensionPrefix, Uri.file(fsPath)).update(constants.configurationSettings.showBuildDuringDeployPrompt, false);
            telemetryProperties.enableScmInput = "No, and don't show again";
        }

        if (!telemetryProperties.enableScmInput) {
            telemetryProperties.enableScmInput = "Canceled";
        }
    }

    public async enableScmDoBuildDuringDeploy(fsPath: string, runtime: string): Promise<void> {
        const zipIgnoreFolders: string[] = this.getIgnoredFoldersForDeployment(runtime);
        let oldSettings: string[] | string | undefined = workspace.getConfiguration(constants.extensionPrefix, Uri.file(fsPath)).get(constants.configurationSettings.zipIgnorePattern);
        if (!oldSettings) {
            oldSettings = [];
        } else if (typeof oldSettings === "string") {
            oldSettings = [oldSettings];
            // settings have to be an array to concat the proper zipIgnoreFolders
        }
        const newSettings: string[] = oldSettings;
        for (const folder of zipIgnoreFolders) {
            if (oldSettings.indexOf(folder) < 0) {
                newSettings.push(folder);
            }
        }
        workspace.getConfiguration(constants.extensionPrefix, Uri.file(fsPath)).update(constants.configurationSettings.zipIgnorePattern, newSettings);
        await fse.writeFile(path.join(fsPath, constants.deploymentFileName), constants.deploymentFile);
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

    public showCreatedOutput(actionContext: IActionContext): void {
        const resource: string = this.root.client.isSlot ? 'slot' : 'web app';
        const createdNewAppMsg: string = `Created new ${resource} "${this.root.client.fullName}": https://${this.root.client.defaultHostName}`;
        ext.outputChannel.appendLine(createdNewAppMsg);
        ext.outputChannel.appendLine('');

        const viewOutput: MessageItem = { title: 'View Output' };
        const deployButton: MessageItem = {
            title: 'Deploy'
        };

        // Note: intentionally not waiting for the result of this before returning
        window.showInformationMessage(createdNewAppMsg, deployButton, viewOutput).then(async (result: MessageItem | undefined) => {
            if (result === viewOutput) {
                ext.outputChannel.show();
            } else if (result === deployButton) {
                actionContext.properties.deploy = 'true';
                await deploy(nonNullValue(actionContext), false, this);
            }
        });
    }

    private getIgnoredFoldersForDeployment(runtime: string): string[] {
        let ignoredFolders: string[];
        switch (runtime) {
            case LinuxRuntimes.node:
                ignoredFolders = ['node_modules{,/**}'];
            case LinuxRuntimes.python:
                // list of Python ignorables are pulled from here https://github.com/github/gitignore/blob/master/Python.gitignore
                // Byte-compiled / optimized / DLL files
                ignoredFolders = ['__pycache__{,/**}', '*.py[cod]', '*$py.class',
                    // Distribution / packaging
                    '.Python{,/**}', 'build{,/**}', 'develop-eggs{,/**}', 'dist{,/**}', 'downloads{,/**}', 'eggs{,/**}', '.eggs{,/**}', 'lib{,/**}', 'lib64{,/**}', 'parts{,/**}', 'sdist{,/**}', 'var{,/**}',
                    'wheels{,/**}', 'share/python-wheels{,/**}', '*.egg-info{,/**}', '.installed.cfg', '*.egg', 'MANIFEST',
                    // Environments
                    '.env{,/**}', '.venv{,/**}', 'env{,/**}', 'venv{,/**}', 'ENV{,/**}', 'env.bak{,/**}', 'venv.bak{,/**}'];
            default:
                ignoredFolders = [];
        }

        // add .vscode to the ignorePattern since it will never be needed for deployment
        ignoredFolders.push('.vscode{,/**}');
        return ignoredFolders;
    }
}

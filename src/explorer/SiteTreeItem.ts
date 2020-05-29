/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WebSiteModels from 'azure-arm-website/lib/models';
import * as fse from 'fs-extra';
import * as path from 'path';
import { MessageItem } from 'vscode';
import { AppSettingsTreeItem, AppSettingTreeItem, deleteSite, DeploymentsTreeItem, DeploymentTreeItem, FolderTreeItem, ISiteTreeRoot, LinuxRuntimes, LogFilesTreeItem, SiteClient, SiteFilesTreeItem } from 'vscode-azureappservice';
import { AzExtTreeItem, AzureParentTreeItem, AzureTreeItem, DialogResponses, IActionContext } from 'vscode-azureextensionui';
import * as constants from '../constants';
import { ext } from '../extensionVariables';
import { venvUtils } from '../utils/venvUtils';
import { getWorkspaceSetting, updateWorkspaceSetting } from '../vsCodeConfig/settings';
import { ConnectionsTreeItem } from './ConnectionsTreeItem';
import { CosmosDBConnection } from './CosmosDBConnection';
import { CosmosDBTreeItem } from './CosmosDBTreeItem';
import { NotAvailableTreeItem } from './NotAvailableTreeItem';
import { WebJobsNATreeItem, WebJobsTreeItem } from './WebJobsTreeItem';

export abstract class SiteTreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public readonly abstract contextValue: string;
    public readonly abstract label: string;

    public readonly appSettingsNode: AppSettingsTreeItem;
    public deploymentsNode: DeploymentsTreeItem | undefined;

    private readonly _connectionsNode: ConnectionsTreeItem;
    private readonly _siteFilesNode: SiteFilesTreeItem;
    private readonly _logFilesNode: LogFilesTreeItem;
    private readonly _webJobsNode: WebJobsTreeItem | WebJobsNATreeItem;

    private readonly _root: ISiteTreeRoot;
    private _state?: string;

    constructor(parent: AzureParentTreeItem, client: SiteClient) {
        super(parent);
        this._root = Object.assign({}, parent.root, { client });
        this._state = client.initialState;

        this.appSettingsNode = new AppSettingsTreeItem(this);
        this._connectionsNode = new ConnectionsTreeItem(this);
        this._siteFilesNode = new SiteFilesTreeItem(this, false);
        this._logFilesNode = new LogFilesTreeItem(this);
        // Can't find actual documentation on this, but the portal claims it and this feedback suggests it's not planned https://aka.ms/AA4q5gi
        this._webJobsNode = this.root.client.isLinux ? new WebJobsNATreeItem(this) : new WebJobsTreeItem(this);
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

    public async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzureTreeItem<ISiteTreeRoot>[]> {
        const siteConfig: WebSiteModels.SiteConfig = await this.root.client.getSiteConfig();
        const sourceControl: WebSiteModels.SiteSourceControl = await this.root.client.getSourceControl();
        this.deploymentsNode = new DeploymentsTreeItem(this, siteConfig, sourceControl);
        return [this.appSettingsNode, this._connectionsNode, this.deploymentsNode, this._siteFilesNode, this._logFilesNode, this._webJobsNode];
    }

    public compareChildrenImpl(ti1: AzureTreeItem<ISiteTreeRoot>, ti2: AzureTreeItem<ISiteTreeRoot>): number {
        if (ti1 instanceof NotAvailableTreeItem) {
            return 1;
        } else if (ti2 instanceof NotAvailableTreeItem) {
            return -1;
        } else {
            return ti1.label.localeCompare(ti2.label);
        }
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
                    return this._siteFilesNode;
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

    public async promptScmDoBuildDeploy(fsPath: string, runtime: string, context: IActionContext): Promise<void> {
        context.telemetry.properties.enableScmInput = "Canceled";

        const learnMoreLink: string = 'https://aka.ms/Kwwkbd';

        const buildDuringDeploy: string = `Would you like to update your workspace configuration to run build commands on the target server? This should improve deployment performance.`;
        const input: MessageItem | undefined = await ext.ui.showWarningMessage(buildDuringDeploy, { modal: true, learnMoreLink }, DialogResponses.yes, DialogResponses.no);

        if (input === DialogResponses.yes) {
            await this.enableScmDoBuildDuringDeploy(fsPath, runtime);
            context.telemetry.properties.enableScmInput = "Yes";
        } else {
            await updateWorkspaceSetting(constants.configurationSettings.showBuildDuringDeployPrompt, false, fsPath);
            context.telemetry.properties.enableScmInput = "No";
        }
    }

    public async enableScmDoBuildDuringDeploy(fsPath: string, runtime: string): Promise<void> {
        const zipIgnoreFolders: string[] = await this.getIgnoredFoldersForDeployment(fsPath, runtime);
        let oldSettings: string[] | string | undefined = getWorkspaceSetting(constants.configurationSettings.zipIgnorePattern, fsPath);
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
        await updateWorkspaceSetting(constants.configurationSettings.zipIgnorePattern, newSettings, fsPath);
        await fse.writeFile(path.join(fsPath, constants.deploymentFileName), constants.deploymentFile);
    }

    public async promptToSaveDeployDefaults(context: IActionContext, workspacePath: string, deployPath: string): Promise<void> {
        const defaultWebAppToDeploySetting: string | undefined = getWorkspaceSetting(constants.configurationSettings.defaultWebAppToDeploy, workspacePath);
        // only prompt if setting is unset
        if (!defaultWebAppToDeploySetting) {
            const saveDeploymentConfig: string = `Always deploy the workspace "${path.basename(workspacePath)}" to "${this.root.client.fullName}"?`;
            const dontShowAgain: MessageItem = { title: "Don't show again" };
            const result: MessageItem = await ext.ui.showWarningMessage(saveDeploymentConfig, DialogResponses.yes, dontShowAgain, DialogResponses.skipForNow);
            if (result === DialogResponses.yes) {
                await updateWorkspaceSetting(constants.configurationSettings.defaultWebAppToDeploy, this.fullId, deployPath);
                // tslint:disable-next-line: strict-boolean-expressions
                const subPath: string = path.relative(workspacePath, deployPath) || '.';
                await updateWorkspaceSetting(constants.configurationSettings.deploySubpath, subPath, deployPath);
                context.telemetry.properties.promptToSaveDeployConfigs = 'Yes';
            } else if (result === dontShowAgain) {
                await updateWorkspaceSetting(constants.configurationSettings.defaultWebAppToDeploy, constants.none, deployPath);
                context.telemetry.properties.promptToSaveDeployConfigs = "Don't show again";
            } else {
                context.telemetry.properties.promptToSaveDeployConfigs = 'Skip for now';
            }
        }

    }

    private async getIgnoredFoldersForDeployment(fsPath: string, runtime: string): Promise<string[]> {
        let ignoredFolders: string[];
        switch (runtime) {
            case LinuxRuntimes.node:
                ignoredFolders = ['node_modules{,/**}'];
                break;
            case LinuxRuntimes.python:
                let venvFsPaths: string[];
                try {
                    venvFsPaths = (await venvUtils.getExistingVenvs(fsPath)).map(venvPath => `${venvPath}{,/**}`);
                } catch (error) {
                    // if there was an error here, don't block-- just assume none could be detected
                    venvFsPaths = [];
                }

                // list of Python ignorables are pulled from here https://github.com/github/gitignore/blob/master/Python.gitignore
                // Byte-compiled / optimized / DLL files
                ignoredFolders = ['__pycache__{,/**}', '*.py[cod]', '*$py.class',
                    // Distribution / packaging
                    '.Python{,/**}', 'build{,/**}', 'develop-eggs{,/**}', 'dist{,/**}', 'downloads{,/**}', 'eggs{,/**}', '.eggs{,/**}', 'lib{,/**}', 'lib64{,/**}', 'parts{,/**}', 'sdist{,/**}', 'var{,/**}',
                    'wheels{,/**}', 'share/python-wheels{,/**}', '*.egg-info{,/**}', '.installed.cfg', '*.egg', 'MANIFEST'];

                // Virtual Environments
                const defaultVenvPaths: string[] = ['.env{,/**}', '.venv{,/**}', 'env{,/**}', 'venv{,/**}', 'ENV{,/**}', 'env.bak{,/**}', 'venv.bak{,/**}'];
                for (const venvPath of venvFsPaths) {
                    // don't add duplicates
                    if (!defaultVenvPaths.find(p => p === venvPath)) {
                        defaultVenvPaths.push(venvPath);
                    }
                }

                ignoredFolders = ignoredFolders.concat(defaultVenvPaths);
                break;
            default:
                ignoredFolders = [];
        }

        // add .vscode to the ignorePattern since it will never be needed for deployment
        ignoredFolders.push('.vscode{,/**}');
        return ignoredFolders;
    }
}

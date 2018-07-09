/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WebSiteModels from 'azure-arm-website/lib/models';
import { randomBytes } from 'crypto';
import * as fse from 'fs-extra';
import * as opn from 'opn';
import * as path from 'path';
import { ExtensionContext, MessageItem, OutputChannel, Uri, window, workspace, WorkspaceConfiguration, WorkspaceFolder } from 'vscode';
import { deleteSite, deploy, ILogStream, SiteClient, startStreamingLogs } from 'vscode-azureappservice';
import { DialogResponses, IAzureNode, IAzureParentNode, IAzureParentTreeItem, IAzureQuickPickItem, IAzureTreeItem, IAzureUserInput, TelemetryProperties, UserCancelledError } from 'vscode-azureextensionui';
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
        node: IAzureNode<SiteTreeItem>,
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

        if (!fsPath) {
            if (siteConfig.linuxFxVersion && siteConfig.linuxFxVersion.toLowerCase().startsWith(constants.runtimes.tomcat)) {
                fsPath = await showWarQuickPick('Select the war file to deploy...', telemetryProperties);
            } else {
                fsPath = await util.showWorkspaceFoldersQuickPick("Select the folder to deploy", telemetryProperties, constants.configurationSettings.deploySubpath);
            }
        }
        const workspaceConfig: WorkspaceConfiguration = workspace.getConfiguration(constants.extensionPrefix, Uri.file(fsPath));
        if (workspaceConfig.get(constants.configurationSettings.showBuildDuringDeployPrompt)) {
            if (siteConfig.linuxFxVersion && siteConfig.linuxFxVersion.startsWith(constants.runtimes.node) && siteConfig.scmType === 'None' && !(await fse.pathExists(path.join(fsPath, constants.deploymentFileName)))) {
                // check if web app has node runtime, is being zipdeployed, and if there is no .deployment file
                // tslint:disable-next-line:no-unsafe-any
                await this.enableScmDoBuildDuringDeploy(fsPath, constants.runtimes[siteConfig.linuxFxVersion.substring(0, siteConfig.linuxFxVersion.indexOf('|'))]);
            }
        }
        cancelWebsiteValidation(this);
        // tslint:disable-next-line:strict-boolean-expressions
        if (workspace.workspaceFolders && workspace.workspaceFolders.length === 1) {
            const currentWorkspace: WorkspaceFolder = workspace.workspaceFolders[0];
            if (currentWorkspace.uri.fsPath === fsPath || this.isSubpath(currentWorkspace.uri.fsPath, fsPath)) {
                // only check the deployConfig if the deployed project is path of the currentWorkspace
                const deployConfig: { app: string, subpath: string, dontWarnAgain?: boolean } | undefined = workspace.getConfiguration(constants.extensionPrefix, currentWorkspace.uri).get(constants.configurationSettings.deploymentConfigurations);
                if (!deployConfig || deployConfig && (!deployConfig.app || deployConfig.subpath === undefined) && deployConfig.dontWarnAgain !== true) {
                    // only prompt under the following conditions
                    // No deploy config was found
                    // If the depolyConfig is corrupted AND dontWarnAgain is not true
                    await this.promptToSaveDeployConfigs(node, currentWorkspace.uri.fsPath, fsPath);
                }
            }
        }

        await node.runWithTemporaryDescription("Deploying...", async () => {
            await deploy(this.client, <string>fsPath, outputChannel, ui, configurationSectionName, confirmDeployment, telemetryProperties);
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

    private async promptToSaveDeployConfigs(node: IAzureNode<SiteTreeItem>, currentWorkspacePath: string, fsPath: string): Promise<void> {
        const saveDeploymentConfig: string = `Always deploy the workspace "${fsPath}" to "${node.treeItem.client.fullName}"?`;
        const neverShowAgain: MessageItem = { title: "Never" };
        let result: MessageItem = DialogResponses.learnMore;
        while (result === DialogResponses.learnMore) {
            result = await ext.ui.showWarningMessage(saveDeploymentConfig, DialogResponses.yes, neverShowAgain, DialogResponses.skipForNow, DialogResponses.learnMore);
            if (result === DialogResponses.yes) {
                workspace.getConfiguration(constants.extensionPrefix, Uri.file(fsPath)).update(constants.configurationSettings.deploymentConfigurations, {
                    app: node.id,
                    subpath: path.relative(currentWorkspacePath, fsPath)
                });
            } else if (result === neverShowAgain) {
                workspace.getConfiguration(constants.extensionPrefix, Uri.file(fsPath)).update(constants.configurationSettings.deploymentConfigurations, {
                    dontShowAgain: true
                });
            } else if (result === DialogResponses.learnMore) {
                // tslint:disable-next-line:no-unsafe-any
                opn('https://aka.ms/AA1pq88');
            }
        }

    }

    private isSubpath(expectedParent: string, expectedChild: string): boolean {
        const relativePath: string = path.relative(expectedParent, expectedChild);
        return relativePath !== '' && !relativePath.startsWith('..') && relativePath !== expectedChild;
    }
}

function getRandomHexString(length: number): string {
    const buffer: Buffer = randomBytes(Math.ceil(length / 2));
    return buffer.toString('hex').slice(0, length);
}

async function showWarQuickPick(placeHolderString: string, telemetryProperties: TelemetryProperties): Promise<string> {
    const warFiles: Uri[] = await workspace.findFiles('**/*.war');
    const warQuickPickItems: IAzureQuickPickItem<string | undefined>[] = warFiles.map((uri: Uri) => {
        return {
            label: path.basename(uri.fsPath),
            description: uri.fsPath,
            data: uri.fsPath
        };
    });

    warQuickPickItems.push({ label: '$(package) Browse...', description: '', data: undefined });

    const warQuickPickOption = { placeHolder: placeHolderString };
    const pickedItem = await window.showQuickPick(warQuickPickItems, warQuickPickOption);

    if (!pickedItem) {
        telemetryProperties.cancelStep = 'showWar';
        throw new UserCancelledError();
    } else if (!pickedItem.data) {
        const browseResult = await window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            defaultUri: workspace.workspaceFolders ? workspace.workspaceFolders[0].uri : undefined,
            filters: { War: ['war'] }
        });

        if (!browseResult) {
            telemetryProperties.cancelStep = 'showWarBrowse';
            throw new UserCancelledError();
        }

        return browseResult[0].fsPath;
    } else {
        return pickedItem.data;
    }
}

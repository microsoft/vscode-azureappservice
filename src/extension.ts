/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { SiteConfigResource } from 'azure-arm-website/lib/models';
import * as vscode from 'vscode';
import { AppSettingsTreeItem, AppSettingTreeItem, DeploymentsTreeItem, ISiteTreeRoot, registerAppServiceExtensionVariables, SiteClient, stopStreamingLogs } from 'vscode-azureappservice';
import { AzureParentTreeItem, AzureTreeDataProvider, AzureTreeItem, AzureUserInput, callWithTelemetryAndErrorHandling, createApiProvider, createTelemetryReporter, IActionContext, IAzureUserInput, registerCommand, registerEvent, registerUIExtensionVariables, SubscriptionTreeItem } from 'vscode-azureextensionui';
import { AzureExtensionApiProvider } from 'vscode-azureextensionui/api';
import { downloadAppSettings } from './commands/appSettings/downloadAppSettings';
import { toggleSlotSetting } from './commands/appSettings/toggleSlotSetting';
import { uploadAppSettings } from './commands/appSettings/uploadAppSettings';
import { addCosmosDBConnection } from './commands/connections/addCosmosDBConnection';
import { removeCosmosDBConnection } from './commands/connections/removeCosmosDBConnection';
import { revealConnection } from './commands/connections/revealConnection';
import { revealConnectionInAppSettings } from './commands/connections/revealConnectionInAppSettings';
import { deploy } from './commands/deploy';
import { connectToGitHub } from './commands/deployments/connectToGitHub';
import { disconnectRepo } from './commands/deployments/disconnectRepo';
import { editScmType } from './commands/deployments/editScmType';
import { redeployDeployment } from './commands/deployments/redeployDeployment';
import { viewCommitInGitHub } from './commands/deployments/viewCommitInGitHub';
import { viewDeploymentLogs } from './commands/deployments/viewDeploymentLogs';
import { enableFileLogging } from './commands/enableFileLogging';
import { disableRemoteDebug } from './commands/remoteDebug/disableRemoteDebug';
import { startRemoteDebug } from './commands/remoteDebug/startRemoteDebug';
import { showFile } from './commands/showFile';
import { startSsh } from './commands/startSsh';
import { startStreamingLogs } from './commands/startStreamingLogs';
import { swapSlots } from './commands/swapSlots';
import { toggleValueVisibilityCommandId } from './constants';
import { DeploymentSlotsNATreeItem, DeploymentSlotsTreeItem, ScaleUpTreeItem } from './explorer/DeploymentSlotsTreeItem';
import { DeploymentSlotTreeItem } from './explorer/DeploymentSlotTreeItem';
import { FileEditor } from './explorer/editors/FileEditor';
import { FileTreeItem } from './explorer/FileTreeItem';
import { FolderTreeItem } from './explorer/FolderTreeItem';
import { LoadedScriptsProvider, openScript } from './explorer/loadedScriptsExplorer';
import { SiteTreeItem } from './explorer/SiteTreeItem';
import { WebAppProvider } from './explorer/WebAppProvider';
import { WebAppTreeItem } from './explorer/WebAppTreeItem';
import { ext } from './extensionVariables';
import { LogPointsManager } from './logPoints/LogPointsManager';
import { LogPointsSessionWizard } from './logPoints/LogPointsSessionWizard';
import { RemoteScriptDocumentProvider, RemoteScriptSchema } from './logPoints/remoteScriptDocumentProvider';
import { LogpointsCollection } from './logPoints/structs/LogpointsCollection';
import { openUrl } from './utils/openUrl';

// tslint:disable-next-line:export-name
// tslint:disable-next-line:max-func-body-length
export async function activateInternal(
    context: vscode.ExtensionContext,
    perfStats: {
        loadStartTime: number, loadEndTime: number
    }
): Promise<AzureExtensionApiProvider> {
    ext.context = context;
    ext.reporter = createTelemetryReporter(context);

    const ui: IAzureUserInput = new AzureUserInput(context.globalState);
    ext.ui = ui;

    ext.outputChannel = vscode.window.createOutputChannel("Azure App Service");
    context.subscriptions.push(ext.outputChannel);

    registerUIExtensionVariables(ext);
    registerAppServiceExtensionVariables(ext);

    // tslint:disable-next-line:max-func-body-length
    await callWithTelemetryAndErrorHandling('appService.activate', async function (this: IActionContext): Promise<void> {
        this.properties.isActivationEvent = 'true';
        this.measurements.mainFileLoad = (perfStats.loadEndTime - perfStats.loadStartTime) / 1000;

        const tree = new AzureTreeDataProvider(WebAppProvider, 'appService.LoadMore');
        ext.tree = tree;
        context.subscriptions.push(tree);

        ext.treeView = vscode.window.createTreeView('azureAppService', { treeDataProvider: tree });
        context.subscriptions.push(ext.treeView);

        const fileEditor: FileEditor = new FileEditor();
        context.subscriptions.push(fileEditor);

        // loaded scripts
        const provider = new LoadedScriptsProvider(context);
        context.subscriptions.push(vscode.window.registerTreeDataProvider('appservice.loadedScriptsExplorer.jsLogpoints', provider));

        const documentProvider = new RemoteScriptDocumentProvider();
        context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(RemoteScriptSchema.schema, documentProvider));

        const logPointsManager = new LogPointsManager();
        context.subscriptions.push(logPointsManager);

        const pathIcon = context.asAbsolutePath('resources/logpoint.svg');
        const logpointDecorationType = vscode.window.createTextEditorDecorationType({
            gutterIconPath: pathIcon,
            overviewRulerLane: vscode.OverviewRulerLane.Full,
            overviewRulerColor: "rgba(21, 126, 251, 0.7)"
        });
        context.subscriptions.push(logpointDecorationType);

        LogpointsCollection.TextEditorDecorationType = logpointDecorationType;

        const yesButton: vscode.MessageItem = { title: 'Yes' };
        const noButton: vscode.MessageItem = { title: 'No', isCloseAffordance: true };

        registerCommand('appService.Refresh', async (node?: AzureTreeItem) => await ext.tree.refresh(node));
        registerCommand('appService.selectSubscriptions', () => vscode.commands.executeCommand("azure-account.selectSubscriptions"));
        registerCommand('appService.LoadMore', async (node: AzureTreeItem) => await ext.tree.loadMore(node));
        registerCommand('appService.Browse', async (node?: SiteTreeItem) => {
            if (!node) {
                node = <WebAppTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue);
            }

            await node.browse();
        });
        registerCommand('appService.OpenInPortal', async (node?: AzureTreeItem<ISiteTreeRoot>) => {
            if (!node) {
                node = <WebAppTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue);
            }

            switch (node.contextValue) {
                // the deep link for slots does not follow the conventional pattern of including its parent in the path name so this is how we extract the slot's id
                case DeploymentSlotsTreeItem.contextValue:
                    // tslint:disable-next-line:no-non-null-assertion
                    await node.openInPortal(`${node.parent!.fullId}/deploymentSlots`);
                    return;
                // the deep link for "Deployments" do not follow the conventional pattern of including its parent in the path name so we need to pass the "Deployment Center" url directly
                case DeploymentsTreeItem.contextValueConnected:
                case DeploymentsTreeItem.contextValueUnconnected:
                    await node.openInPortal(`${node.root.client.id}/vstscd`);
                    return;
                default:
                    await node.openInPortal();
                    return;
            }
        });
        registerCommand('appService.Start', async (node?: SiteTreeItem) => {
            if (!node) {
                node = <WebAppTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue);
            }

            const client: SiteClient = node.root.client;
            const startingApp: string = `Starting "${client.fullName}"...`;
            const startedApp: string = `"${client.fullName}" has been started.`;
            await node.runWithTemporaryDescription("Starting...", async () => {
                ext.outputChannel.appendLine(startingApp);
                await client.start();
                ext.outputChannel.appendLine(startedApp);
            });
        });
        registerCommand('appService.Stop', async (node?: SiteTreeItem) => {
            if (!node) {
                node = <WebAppTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue);
            }

            const client: SiteClient = node.root.client;
            const stoppingApp: string = `Stopping "${client.fullName}"...`;
            const stoppedApp: string = `"${client.fullName}" has been stopped. App Service plan charges still apply.`;
            await node.runWithTemporaryDescription("Stopping...", async () => {
                ext.outputChannel.appendLine(stoppingApp);
                await client.stop();
                ext.outputChannel.appendLine(stoppedApp);
            });

            await logPointsManager.onAppServiceSiteClosed(client);
        });
        registerCommand('appService.Restart', async (node?: SiteTreeItem) => {
            if (!node) {
                node = <WebAppTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue);
            }
            await vscode.commands.executeCommand('appService.Stop', node);
            await vscode.commands.executeCommand('appService.Start', node);
            await logPointsManager.onAppServiceSiteClosed(node.root.client);
        });
        registerCommand('appService.Delete', async (node?: SiteTreeItem) => {
            if (!node) {
                node = <WebAppTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue);
            }

            await node.deleteTreeItem();
        });
        registerCommand('appService.CreateWebApp', async function (this: IActionContext, node?: AzureParentTreeItem): Promise<void> {
            if (!node) {
                node = <AzureParentTreeItem>await ext.tree.showTreeItemPicker(SubscriptionTreeItem.contextValue);
            }

            const createdApp = <WebAppTreeItem>await node.createChild(this);
            createdApp.root.client.getSiteConfig().then(
                (createdAppConfig: SiteConfigResource) => {
                    this.properties.linuxFxVersion = createdAppConfig.linuxFxVersion ? createdAppConfig.linuxFxVersion : 'undefined';
                    this.properties.createdFromDeploy = 'false';
                },
                () => {
                    // ignore
                });
            // prompt user to deploy to newly created web app
            vscode.window.showInformationMessage('Deploy to web app?', yesButton, noButton).then(
                async (input: vscode.MessageItem) => {
                    if (input === yesButton) {
                        await deploy(this, false, createdApp);
                    }
                });
        });
        registerCommand('appService.Deploy', async function (this: IActionContext, target?: vscode.Uri | WebAppTreeItem | undefined): Promise<void> {
            await deploy(this, true, target);
        });
        registerCommand('appService.ConfigureDeploymentSource', async function (this: IActionContext, node?: DeploymentsTreeItem): Promise<void> {
            await editScmType(this, node);

        });
        registerCommand('appService.OpenVSTSCD', async (node?: WebAppTreeItem) => {
            if (!node) {
                node = <WebAppTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue);
            }

            await node.openCdInPortal();
        });
        registerCommand('appService.DeploymentScript', async (node?: WebAppTreeItem) => {
            if (!node) {
                node = <WebAppTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue);
            }

            await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
                p.report({ message: 'Generating script...' });
                // tslint:disable-next-line:no-non-null-assertion
                await node!.generateDeploymentScript();
            });
        });
        registerCommand('appService.CreateSlot', async function (this: IActionContext, node?: DeploymentSlotsTreeItem): Promise<void> {
            const deployingToDeploymentSlot = 'deployingToDeploymentSlot';

            if (!node) {
                node = <DeploymentSlotsTreeItem>await ext.tree.showTreeItemPicker(DeploymentSlotsTreeItem.contextValue);
            }

            const createdSlot = <SiteTreeItem>await node.createChild(this);

            // prompt user to deploy to newly created web app
            vscode.window.showInformationMessage('Deploy to deployment slot?', yesButton, noButton).then(async (input) => {
                if (input === yesButton) {
                    this.properties[deployingToDeploymentSlot] = 'true';
                    await deploy(this, false, createdSlot);
                } else {
                    this.properties[deployingToDeploymentSlot] = 'false';
                }
            });
        });
        registerCommand('appService.SwapSlots', async (node: DeploymentSlotTreeItem) => await swapSlots(node));
        registerCommand('appService.appSettings.Add', async (node?: AppSettingsTreeItem) => {
            if (!node) {
                node = <AppSettingsTreeItem>await ext.tree.showTreeItemPicker(AppSettingsTreeItem.contextValue);
            }

            await node.createChild();
        });
        registerCommand('appService.appSettings.Edit', async (node?: AppSettingTreeItem) => {
            if (!node) {
                node = <AppSettingTreeItem>await ext.tree.showTreeItemPicker(AppSettingTreeItem.contextValue);
            }
            await node.edit();
        });
        registerCommand('appService.appSettings.Rename', async (node?: AppSettingTreeItem) => {
            if (!node) {
                node = <AppSettingTreeItem>await ext.tree.showTreeItemPicker(AppSettingTreeItem.contextValue);
            }

            await node.rename();
        });
        registerCommand('appService.appSettings.Delete', async (node?: AppSettingTreeItem) => {
            if (!node) {
                node = <AppSettingTreeItem>await ext.tree.showTreeItemPicker(AppSettingTreeItem.contextValue);
            }

            await node.deleteTreeItem();
        });
        registerCommand('appService.appSettings.Download', downloadAppSettings);
        registerCommand('appService.appSettings.Upload', uploadAppSettings);
        registerCommand('appService.appSettings.ToggleSlotSetting', toggleSlotSetting);
        registerCommand('appService.OpenLogStream', startStreamingLogs);
        registerCommand('appService.StopLogStream', async (node?: SiteTreeItem) => {
            if (!node) {
                node = <WebAppTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue);
            }

            await stopStreamingLogs(node.root.client);
        });
        registerCommand('appService.StartLogPointsSession', async function (this: IActionContext, node?: SiteTreeItem): Promise<void> {
            if (node) {
                const wizard = new LogPointsSessionWizard(logPointsManager, context, ext.outputChannel, node, node.root.client);
                await wizard.run(this.properties);
            }
        });

        registerCommand('appService.LogPoints.Toggle', async (uri: vscode.Uri) => {
            await logPointsManager.toggleLogpoint(uri);
        });

        registerCommand('appService.LogPoints.OpenScript', openScript);

        registerCommand('appService.StartRemoteDebug', async function (this: IActionContext, node?: SiteTreeItem): Promise<void> { await startRemoteDebug(this, node); });
        registerCommand('appService.DisableRemoteDebug', async function (this: IActionContext, node?: SiteTreeItem): Promise<void> { await disableRemoteDebug(this, node); });
        registerCommand('appService.StartSsh', startSsh);

        registerCommand('appService.showFile', async (node: FileTreeItem) => { await showFile(node, fileEditor); }, 500);
        registerCommand('appService.ScaleUp', async (node: DeploymentSlotsNATreeItem | ScaleUpTreeItem) => {
            await node.openInPortal(node.scaleUpId);
        });

        registerEvent('appService.fileEditor.onDidSaveTextDocument', vscode.workspace.onDidSaveTextDocument, async function (this: IActionContext, doc: vscode.TextDocument): Promise<void> { await fileEditor.onDidSaveTextDocument(this, context.globalState, doc); });
        registerCommand('appService.EnableFileLogging', async (node?: SiteTreeItem | FolderTreeItem) => {
            if (!node) {
                node = <SiteTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue);
            }

            if (node instanceof FolderTreeItem) {
                // If the entry point was the Files/Log Files node, pass the parent as that's where the logic lives
                node = <SiteTreeItem>node.parent;
            }
            const isEnabled = await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
                p.report({ message: 'Checking container diagnostics settings...' });
                return await (<SiteTreeItem>node).isHttpLogsEnabled();
            });

            if (!isEnabled) {
                await enableFileLogging(<SiteTreeItem>node);
            } else {
                // tslint:disable-next-line:no-non-null-assertion
                vscode.window.showInformationMessage(`File logging has already been enabled for ${node.root.client.fullName}.`);
            }
        });
        registerCommand('appService.InstallCosmosDBExtension', async () => {
            const commandToRun = 'extension.open';
            const listOfCommands = await vscode.commands.getCommands();
            if (listOfCommands.find((x: string) => x === commandToRun)) {
                vscode.commands.executeCommand(commandToRun, 'ms-azuretools.vscode-cosmosdb');
            } else {
                await openUrl('https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-cosmosdb');
            }
        });
        registerCommand('appService.AddCosmosDBConnection', addCosmosDBConnection);
        registerCommand('appService.RemoveCosmosDBConnection', removeCosmosDBConnection);
        registerCommand('appService.RevealConnection', revealConnection);
        registerCommand('appService.RevealConnectionInAppSettings', revealConnectionInAppSettings);
        registerCommand('appService.ViewDeploymentLogs', viewDeploymentLogs);
        registerCommand('appService.Redeploy', redeployDeployment);
        registerCommand('appService.DisconnectRepo', disconnectRepo);
        registerCommand('appService.ConnectToGitHub', connectToGitHub);
        registerCommand(toggleValueVisibilityCommandId, async (node: AppSettingTreeItem) => { await node.toggleValueVisibility(); }, 250);
        registerCommand('appService.ViewCommitInGitHub', viewCommitInGitHub);
    });

    return createApiProvider([]);
}

// tslint:disable-next-line:no-empty
export function deactivateInternal(): void {
}

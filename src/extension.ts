/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import { AppSettingsTreeItem, AppSettingTreeItem, DeploymentsTreeItem, FileTreeItem, ISiteTreeRoot, LogFilesTreeItem, registerAppServiceExtensionVariables, registerSiteCommand, SiteClient, stopStreamingLogs } from 'vscode-azureappservice';
import { AzExtTreeDataProvider, AzureTreeItem, AzureUserInput, callWithTelemetryAndErrorHandling, createApiProvider, createAzExtOutputChannel, createTelemetryReporter, IActionContext, IAzureUserInput, openInPortal, registerCommand, registerEvent, registerUIExtensionVariables } from 'vscode-azureextensionui';
import { AzureExtensionApiProvider } from 'vscode-azureextensionui/api';
import { downloadAppSettings } from './commands/appSettings/downloadAppSettings';
import { toggleSlotSetting } from './commands/appSettings/toggleSlotSetting';
import { uploadAppSettings } from './commands/appSettings/uploadAppSettings';
import { addCosmosDBConnection } from './commands/connections/addCosmosDBConnection';
import { removeCosmosDBConnection } from './commands/connections/removeCosmosDBConnection';
import { revealConnection } from './commands/connections/revealConnection';
import { revealConnectionInAppSettings } from './commands/connections/revealConnectionInAppSettings';
import { createSlot } from './commands/createSlot';
import { createWebApp, createWebAppAdvanced } from './commands/createWebApp/createWebApp';
import { deploy } from './commands/deploy/deploy';
import { connectToGitHub } from './commands/deployments/connectToGitHub';
import { disconnectRepo } from './commands/deployments/disconnectRepo';
import { editScmType } from './commands/deployments/editScmType';
import { redeployDeployment } from './commands/deployments/redeployDeployment';
import { viewCommitInGitHub } from './commands/deployments/viewCommitInGitHub';
import { viewDeploymentLogs } from './commands/deployments/viewDeploymentLogs';
import { enableFileLogging } from './commands/enableFileLogging';
import { installCosmosDBExtension } from './commands/installCosmosDBExtension';
import { startRemoteDebug } from './commands/remoteDebug/startRemoteDebug';
import { showFile } from './commands/showFile';
import { startSsh } from './commands/startSsh';
import { startStreamingLogs } from './commands/startStreamingLogs';
import { swapSlots } from './commands/swapSlots';
import { AzureAccountTreeItem } from './explorer/AzureAccountTreeItem';
import { DeploymentSlotsNATreeItem, DeploymentSlotsTreeItem, ScaleUpTreeItem } from './explorer/DeploymentSlotsTreeItem';
import { DeploymentSlotTreeItem } from './explorer/DeploymentSlotTreeItem';
import { FileEditor } from './explorer/editors/FileEditor';
import { SiteTreeItem } from './explorer/SiteTreeItem';
import { WebAppTreeItem } from './explorer/WebAppTreeItem';
import { ext } from './extensionVariables';
import { nonNullProp, nonNullValue } from './utils/nonNull';

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

    ext.outputChannel = createAzExtOutputChannel("Azure App Service", ext.prefix);
    context.subscriptions.push(ext.outputChannel);

    registerUIExtensionVariables(ext);
    registerAppServiceExtensionVariables(ext);

    // tslint:disable-next-line:max-func-body-length
    await callWithTelemetryAndErrorHandling('appService.activate', async (activateContext: IActionContext) => {
        activateContext.telemetry.properties.isActivationEvent = 'true';
        activateContext.telemetry.measurements.mainFileLoad = (perfStats.loadEndTime - perfStats.loadStartTime) / 1000;

        ext.azureAccountTreeItem = new AzureAccountTreeItem();
        context.subscriptions.push(ext.azureAccountTreeItem);
        ext.tree = new AzExtTreeDataProvider(ext.azureAccountTreeItem, 'appService.LoadMore');

        ext.treeView = vscode.window.createTreeView('azureAppService', { treeDataProvider: ext.tree, showCollapseAll: true });
        context.subscriptions.push(ext.treeView);

        const fileEditor: FileEditor = new FileEditor();
        context.subscriptions.push(fileEditor);

        registerCommand('appService.Refresh', async (_actionContext: IActionContext, node?: AzureTreeItem) => await ext.tree.refresh(node));
        registerCommand('appService.selectSubscriptions', () => vscode.commands.executeCommand("azure-account.selectSubscriptions"));
        registerCommand('appService.LoadMore', async (actionContext: IActionContext, node: AzureTreeItem) => await ext.tree.loadMore(node, actionContext));
        registerCommand('appService.Browse', async (actionContext: IActionContext, node?: SiteTreeItem) => {
            if (!node) {
                node = <WebAppTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue, actionContext);
            }

            await node.browse();
        });
        registerCommand('appService.OpenInPortal', async (actionContext: IActionContext, node?: AzureTreeItem<ISiteTreeRoot>) => {
            if (!node) {
                node = <WebAppTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue, actionContext);
            }

            switch (node.contextValue) {
                // the deep link for slots does not follow the conventional pattern of including its parent in the path name so this is how we extract the slot's id
                case DeploymentSlotsTreeItem.contextValue:
                    await openInPortal(node.root, `${nonNullProp(node, 'parent').fullId}/deploymentSlots`);
                    return;
                // the deep link for "Deployments" do not follow the conventional pattern of including its parent in the path name so we need to pass the "Deployment Center" url directly
                case DeploymentsTreeItem.contextValueConnected:
                case DeploymentsTreeItem.contextValueUnconnected:
                    await openInPortal(node.root, `${node.root.client.id}/vstscd`);
                    return;
                default:
                    await node.openInPortal();
                    return;
            }
        });
        registerCommand('appService.Start', async (actionContext: IActionContext, node?: SiteTreeItem) => {
            if (!node) {
                node = <WebAppTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue, actionContext);
            }

            const client: SiteClient = node.root.client;
            const startingApp: string = `Starting "${client.fullName}"...`;
            const startedApp: string = `"${client.fullName}" has been started.`;

            await node.runWithTemporaryDescription("Starting...", async () => {
                ext.outputChannel.appendLog(startingApp);
                await client.start();
                ext.outputChannel.appendLog(startedApp);
            });
        });
        registerCommand('appService.Stop', async (actionContext: IActionContext, node?: SiteTreeItem) => {
            if (!node) {
                node = <WebAppTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue, actionContext);
            }

            const client: SiteClient = node.root.client;
            const stoppingApp: string = `Stopping "${client.fullName}"...`;
            const stoppedApp: string = `"${client.fullName}" has been stopped. App Service plan charges still apply.`;
            await node.runWithTemporaryDescription("Stopping...", async () => {
                ext.outputChannel.appendLog(stoppingApp);
                await client.stop();
                ext.outputChannel.appendLog(stoppedApp);
            });

        });
        registerCommand('appService.Restart', async (actionContext: IActionContext, node?: SiteTreeItem) => {
            if (!node) {
                node = <WebAppTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue, actionContext);
            }
            await vscode.commands.executeCommand('appService.Stop', node);
            await vscode.commands.executeCommand('appService.Start', node);
        });
        registerCommand('appService.Delete', async (actionContext: IActionContext, node?: SiteTreeItem) => {
            if (!node) {
                node = <WebAppTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue, actionContext);
            }

            await node.deleteTreeItem(actionContext);
        });
        registerCommand('appService.CreateWebApp', createWebApp);
        registerCommand('appService.CreateWebAppAdvanced', createWebAppAdvanced);
        registerSiteCommand('appService.Deploy', deploy);
        registerCommand('appService.ConfigureDeploymentSource', editScmType);
        registerCommand('appService.DeploymentScript', async (actionContext: IActionContext, node?: WebAppTreeItem) => {
            if (!node) {
                node = <WebAppTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue, actionContext);
            }

            await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
                p.report({ message: 'Generating script...' });
                await nonNullValue(node).generateDeploymentScript();
            });
        });
        registerCommand('appService.CreateSlot', createSlot);
        registerSiteCommand('appService.DeploySlot', async (actionContext: IActionContext, node?: DeploymentSlotTreeItem | ScaleUpTreeItem | undefined) => {
            if (!node) {
                node = <DeploymentSlotTreeItem | ScaleUpTreeItem>await ext.tree.showTreeItemPicker([DeploymentSlotTreeItem.contextValue, ScaleUpTreeItem.contextValue], actionContext);
            }

            if (node instanceof ScaleUpTreeItem) {
                await openInPortal(node.root, node.scaleUpId);
            } else {
                await deploy(actionContext, node);
            }
        });
        registerCommand('appService.SwapSlots', swapSlots);
        registerCommand('appService.appSettings.Add', async (actionContext: IActionContext, node?: AppSettingsTreeItem) => {
            if (!node) {
                node = <AppSettingsTreeItem>await ext.tree.showTreeItemPicker(AppSettingsTreeItem.contextValue, actionContext);
            }

            await node.createChild(actionContext);
        });
        registerCommand('appService.appSettings.Edit', async (actionContext: IActionContext, node?: AppSettingTreeItem) => {
            if (!node) {
                node = <AppSettingTreeItem>await ext.tree.showTreeItemPicker(AppSettingTreeItem.contextValue, actionContext);
            }
            await node.edit(actionContext);
        });
        registerCommand('appService.appSettings.Rename', async (actionContext: IActionContext, node?: AppSettingTreeItem) => {
            if (!node) {
                node = <AppSettingTreeItem>await ext.tree.showTreeItemPicker(AppSettingTreeItem.contextValue, actionContext);
            }

            await node.rename(actionContext);
        });
        registerCommand('appService.appSettings.Delete', async (actionContext: IActionContext, node?: AppSettingTreeItem) => {
            if (!node) {
                node = <AppSettingTreeItem>await ext.tree.showTreeItemPicker(AppSettingTreeItem.contextValue, actionContext);
            }

            await node.deleteTreeItem(actionContext);
        });
        registerCommand('appService.appSettings.Download', downloadAppSettings);
        registerCommand('appService.appSettings.Upload', uploadAppSettings);
        registerCommand('appService.appSettings.ToggleSlotSetting', toggleSlotSetting);
        registerCommand('appService.startStreamingLogs', startStreamingLogs);
        registerCommand('appService.StopLogStream', async (actionContext: IActionContext, node?: SiteTreeItem) => {
            if (!node) {
                node = <WebAppTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue, actionContext);
            }

            await stopStreamingLogs(node.root.client);
        });

        registerCommand('appService.StartRemoteDebug', startRemoteDebug);
        registerCommand('appService.StartSsh', startSsh);

        registerCommand('appService.openFile', async (_actionContext: IActionContext, node: FileTreeItem) => { await showFile(node, fileEditor); }, 500);
        registerCommand('appService.ScaleUp', async (_actionContext: IActionContext, node: DeploymentSlotsNATreeItem | ScaleUpTreeItem) => {
            await openInPortal(node.root, node.scaleUpId);
        });

        registerEvent('appService.fileEditor.onDidSaveTextDocument', vscode.workspace.onDidSaveTextDocument, async (actionContext: IActionContext, doc: vscode.TextDocument) => { await fileEditor.onDidSaveTextDocument(actionContext, context.globalState, doc); });
        registerCommand('appService.EnableFileLogging', async (actionContext: IActionContext, node?: SiteTreeItem | LogFilesTreeItem) => {
            if (!node) {
                node = <SiteTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue, actionContext);
            }

            if (node instanceof LogFilesTreeItem) {
                // If the entry point was the Log Files node, pass the parent as that's where the logic lives
                node = <SiteTreeItem>node.parent;
            }
            const isEnabled = await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
                p.report({ message: 'Checking container diagnostics settings...' });
                return await (<SiteTreeItem>node).isHttpLogsEnabled();
            });

            if (!isEnabled) {
                await enableFileLogging(<SiteTreeItem>node);
            } else {
                vscode.window.showInformationMessage(`File logging has already been enabled for ${node.root.client.fullName}.`);
            }
        });
        registerCommand('appService.InstallCosmosDBExtension', installCosmosDBExtension);
        registerCommand('appService.AddCosmosDBConnection', addCosmosDBConnection);
        registerCommand('appService.RemoveCosmosDBConnection', removeCosmosDBConnection);
        registerCommand('appService.RevealConnection', revealConnection);
        registerCommand('appService.RevealConnectionInAppSettings', revealConnectionInAppSettings);
        registerSiteCommand('appService.viewDeploymentLogs', viewDeploymentLogs);
        registerSiteCommand('appService.Redeploy', redeployDeployment);
        registerCommand('appService.DisconnectRepo', disconnectRepo);
        registerCommand('appService.connectToGitHub', connectToGitHub);
        registerCommand('appService.toggleAppSettingVisibility', async (_actionContext: IActionContext, node: AppSettingTreeItem) => { await node.toggleValueVisibility(); }, 250);
        registerCommand('appService.ViewCommitInGitHub', viewCommitInGitHub);
        registerCommand('appService.showOutputChannel', () => { ext.outputChannel.show(); });
    });

    return createApiProvider([]);
}

// tslint:disable-next-line:no-empty
export function deactivateInternal(): void {
}

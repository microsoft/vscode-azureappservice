/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import WebSiteManagementClient = require('azure-arm-website');
import * as vscode from 'vscode';
import { AppSettingsTreeItem, AppSettingTreeItem } from 'vscode-azureappservice';
import { AzureActionHandler, AzureTreeDataProvider, IAzureNode, IAzureParentNode, TelemetryMeasurements, TelemetryProperties, UserCancelledError } from 'vscode-azureextensionui';
import TelemetryReporter from 'vscode-extension-telemetry';
import { DeploymentSlotSwapper } from './DeploymentSlotSwapper';
import { LogPointsManager } from './diagnostics/LogPointsManager';
import { LogPointsSessionWizard } from './diagnostics/LogPointsSessionWizard';
import { RemoteScriptDocumentProvider, RemoteScriptSchema } from './diagnostics/remoteScriptDocumentProvider';
import { LogpointsCollection } from './diagnostics/structs/LogpointsCollection';
import { DeploymentSlotsTreeItem } from './explorer/DeploymentSlotsTreeItem';
import { DeploymentSlotTreeItem } from './explorer/DeploymentSlotTreeItem';
import { FileEditor } from './explorer/editors/FileEditor';
import { FileTreeItem } from './explorer/FileTreeItem';
import { LoadedScriptsProvider, openScript } from './explorer/loadedScriptsExplorer';
import { getAppServicePlan, SiteTreeItem } from './explorer/SiteTreeItem';
import { WebAppProvider } from './explorer/WebAppProvider';
import { WebAppTreeItem } from './explorer/WebAppTreeItem';
import * as util from "./util";
import { getPackageInfo, IPackageInfo } from './utils/IPackageInfo';
import { nodeUtils } from './utils/nodeUtils';

// tslint:disable-next-line:export-name
// tslint:disable-next-line:max-func-body-length
export function activate(context: vscode.ExtensionContext): void {
    const packageInfo: IPackageInfo = getPackageInfo(context);
    const reporter = new TelemetryReporter(packageInfo.name, packageInfo.version, packageInfo.aiKey);
    context.subscriptions.push(reporter);

    const outputChannel = util.getOutputChannel();
    context.subscriptions.push(outputChannel);

    const webAppProvider: WebAppProvider = new WebAppProvider(context.globalState);
    const tree = new AzureTreeDataProvider(webAppProvider, 'appService.LoadMore');
    context.subscriptions.push(tree);
    context.subscriptions.push(vscode.window.registerTreeDataProvider('azureAppService', tree));

    const fileEditor: FileEditor = new FileEditor();
    context.subscriptions.push(fileEditor);

    // loaded scripts
    const provider = new LoadedScriptsProvider(context);
    context.subscriptions.push(vscode.window.registerTreeDataProvider('appservice.loadedScriptsExplorer.jsLogpoints', provider));

    const documentProvider = new RemoteScriptDocumentProvider();
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(RemoteScriptSchema.schema, documentProvider));

    const logPointsManager = new LogPointsManager(outputChannel);
    context.subscriptions.push(logPointsManager);

    const pathIcon = context.asAbsolutePath('resources/logpoint.svg');
    const logpointDecorationType = vscode.window.createTextEditorDecorationType({
        gutterIconPath: pathIcon,
        overviewRulerLane: vscode.OverviewRulerLane.Full,
        overviewRulerColor: "rgba(21, 126, 251, 0.7)"
    });
    context.subscriptions.push(logpointDecorationType);

    LogpointsCollection.TextEditorDecorationType = logpointDecorationType;

    const actionHandler: AzureActionHandler = new AzureActionHandler(context, outputChannel, reporter);

    actionHandler.registerCommand('appService.Refresh', async (node?: IAzureNode) => await tree.refresh(node));
    actionHandler.registerCommand('appService.LoadMore', async (node?: IAzureNode) => await tree.loadMore(node));
    actionHandler.registerCommand('appService.Browse', async (node: IAzureNode<SiteTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        node.treeItem.browse();
    });
    actionHandler.registerCommand('appService.OpenInPortal', async (node: IAzureNode) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        node.openInPortal();
    });
    actionHandler.registerCommand('appService.Start', async (node: IAzureNode<SiteTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        const siteType = util.isSiteDeploymentSlot(node.treeItem.site) ? 'Deployment Slot' : 'Web App';
        outputChannel.show();
        outputChannel.appendLine(`Starting ${siteType} "${node.treeItem.site.name}"...`);
        await node.treeItem.start(nodeUtils.getWebSiteClient(node));
        await node.refresh();
        outputChannel.appendLine(`${siteType} "${node.treeItem.site.name}" has been started.`);
    });
    actionHandler.registerCommand('appService.Stop', async (node: IAzureNode<SiteTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        const siteType = util.isSiteDeploymentSlot(node.treeItem.site) ? 'Deployment Slot' : 'Web App';
        outputChannel.show();
        outputChannel.appendLine(`Stopping ${siteType} "${node.treeItem.site.name}"...`);
        await node.treeItem.stop(nodeUtils.getWebSiteClient(node));
        await node.refresh();
        outputChannel.appendLine(`${siteType} "${node.treeItem.site.name}" has been stopped. App Service plan charges still apply.`);

        await logPointsManager.onAppServiceSiteClosed(node.treeItem.site);
    });
    actionHandler.registerCommand('appService.Restart', async (node: IAzureNode<SiteTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        const client: WebSiteManagementClient = nodeUtils.getWebSiteClient(node);
        const siteType = util.isSiteDeploymentSlot(node.treeItem.site) ? 'Deployment Slot' : 'Web App';
        outputChannel.show();
        outputChannel.appendLine(`Restarting ${siteType} "${node.treeItem.site.name}"...`);
        await node.treeItem.restart(client);
        await node.refresh();
        outputChannel.appendLine(`${siteType} "${node.treeItem.site.name}" has been restarted.`);

        await logPointsManager.onAppServiceSiteClosed(node.treeItem.site);
    });
    actionHandler.registerCommand('appService.Delete', async (node: IAzureNode<SiteTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        await node.deleteNode();
    });
    actionHandler.registerCommand('appService.CreateWebApp', async (node?: IAzureParentNode) => {
        if (!node) {
            node = <IAzureParentNode>await tree.showNodePicker(AzureTreeDataProvider.subscriptionContextValue);
        }

        const createdApp = <IAzureNode<WebAppTreeItem>>await node.createChild();

        // prompt user to deploy to newly created web app
        const yesButton: vscode.MessageItem = { title: 'Yes' };
        const noButton: vscode.MessageItem = { title: 'No', isCloseAffordance: true };
        if (await vscode.window.showInformationMessage('Deploy to web app?', yesButton, noButton) === yesButton) {
            const fsPath = await util.showWorkspaceFoldersQuickPick("Select the folder to deploy");
            const client = nodeUtils.getWebSiteClient(createdApp);
            await createdApp.treeItem.siteWrapper.deploy(fsPath, client, outputChannel, 'appService', false);
        }
    });
    actionHandler.registerCommandWithCustomTelemetry('appService.Deploy', async (properties: TelemetryProperties, _measurements: TelemetryMeasurements, target?: vscode.Uri | IAzureNode<WebAppTreeItem> | undefined) => {
        let node: IAzureNode<WebAppTreeItem>;
        let fsPath: string;
        if (target instanceof vscode.Uri) {
            fsPath = target.fsPath;
        } else {
            fsPath = await util.showWorkspaceFoldersQuickPick("Select the folder to deploy");
            node = target;
        }

        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }
        const client = nodeUtils.getWebSiteClient(node);
        try {
            await node.treeItem.siteWrapper.deploy(fsPath, client, outputChannel, 'appService');
        } catch (err) {
            if (err instanceof UserCancelledError) {
                throw err;
            }
            const appServicePlan = await getAppServicePlan(node.treeItem.site, client);
            properties.servicePlan = appServicePlan.sku.size;
            throw err;
        }
    });
    actionHandler.registerCommand('appService.ConfigureDeploymentSource', async (node: IAzureNode<SiteTreeItem>) => {
        if (!node) {
            node = <IAzureNode<SiteTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }
        const updatedScmType = await node.treeItem.editScmType(nodeUtils.getWebSiteClient(node));
        outputChannel.appendLine(`Deployment source for "${node.treeItem.site.name}" has been updated to "${updatedScmType}".`);
    });
    actionHandler.registerCommand('appService.OpenVSTSCD', async (node?: IAzureNode<WebAppTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        node.treeItem.openCdInPortal(node);
    });
    actionHandler.registerCommand('appService.DeploymentScript', async (node: IAzureNode<WebAppTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            p.report({ message: 'Generating script...' });
            await node.treeItem.generateDeploymentScript(node);
        });
    });
    actionHandler.registerCommand('deploymentSlots.CreateSlot', async (node: IAzureParentNode<DeploymentSlotsTreeItem>) => {
        if (!node) {
            node = <IAzureParentNode<DeploymentSlotsTreeItem>>await tree.showNodePicker(DeploymentSlotsTreeItem.contextValue);
        }

        const createdSlot = <IAzureNode<SiteTreeItem>>await node.createChild();

        // prompt user to deploy to newly created web app
        const yesButton: vscode.MessageItem = { title: 'Yes' };
        const noButton: vscode.MessageItem = { title: 'No', isCloseAffordance: true };
        if (await vscode.window.showInformationMessage('Deploy to deployment slot?', yesButton, noButton) === yesButton) {
            const fsPath = await util.showWorkspaceFoldersQuickPick("Select the folder to deploy");
            const client = nodeUtils.getWebSiteClient(createdSlot);
            await createdSlot.treeItem.siteWrapper.deploy(fsPath, client, outputChannel, 'appService', false);
        }
    });
    actionHandler.registerCommandWithCustomTelemetry('deploymentSlot.SwapSlots', async (properties: TelemetryProperties, _measurements: TelemetryMeasurements, node: IAzureNode<DeploymentSlotTreeItem>) => {
        if (!node) {
            node = <IAzureNode<DeploymentSlotTreeItem>>await tree.showNodePicker(DeploymentSlotTreeItem.contextValue);
        }

        const wizard = new DeploymentSlotSwapper(outputChannel, node);
        await wizard.run(properties);
    });
    actionHandler.registerCommand('appSettings.Add', async (node: IAzureParentNode<AppSettingsTreeItem>) => {
        if (!node) {
            node = <IAzureParentNode<AppSettingsTreeItem>>await tree.showNodePicker(AppSettingsTreeItem.contextValue);
        }

        await node.createChild();
    });
    actionHandler.registerCommand('appSettings.Edit', async (node: IAzureNode<AppSettingTreeItem>) => {
        if (!node) {
            node = <IAzureNode<AppSettingTreeItem>>await tree.showNodePicker(AppSettingTreeItem.contextValue);
        }

        await node.treeItem.edit(node);
    });
    actionHandler.registerCommand('appSettings.Rename', async (node: IAzureNode<AppSettingTreeItem>) => {
        if (!node) {
            node = <IAzureNode<AppSettingTreeItem>>await tree.showNodePicker(AppSettingTreeItem.contextValue);
        }

        await node.treeItem.rename(node);
    });
    actionHandler.registerCommand('appSettings.Delete', async (node: IAzureNode<AppSettingTreeItem>) => {
        if (!node) {
            node = <IAzureNode<AppSettingTreeItem>>await tree.showNodePicker(AppSettingTreeItem.contextValue);
        }

        await node.deleteNode();
    });
    actionHandler.registerCommand('diagnostics.OpenLogStream', async (node?: IAzureNode<SiteTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        if (node.treeItem.logStream && node.treeItem.logStream.isConnected) {
            // tslint:disable-next-line:no-non-null-assertion
            node.treeItem.logStreamOutputChannel!.show();
            await vscode.window.showWarningMessage(`The log-streaming service for "${node.treeItem.siteWrapper.appName}" is already active.`);
        } else {
            const client: WebSiteManagementClient = nodeUtils.getWebSiteClient(node);
            const enableButton: vscode.MessageItem = { title: 'Yes' };
            const notNowButton: vscode.MessageItem = { title: 'Not Now', isCloseAffordance: true };
            const isEnabled = await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
                p.report({ message: 'Checking container diagnostics settings...' });
                return await node.treeItem.isHttpLogsEnabled(client);
            });

            if (!isEnabled && enableButton === await vscode.window.showWarningMessage(`Do you want to enable application logging for ${node.treeItem.siteWrapper.appName}?`, enableButton, notNowButton)) {
                outputChannel.show();
                outputChannel.appendLine(`Enabling Logging for "${node.treeItem.site.name}"...`);
                await node.treeItem.enableHttpLogs(client);
                await vscode.commands.executeCommand('appService.Restart', node);
            }
            // Otherwise connect to log stream anyways, users might see similar "log not enabled" message with how to enable link from the stream output.
            node.treeItem.logStream = await node.treeItem.connectToLogStream(client, actionHandler, context);
            node.treeItem.logStreamOutputChannel.show();
        }
    });
    actionHandler.registerCommand('diagnostics.StopLogStream', async (node?: IAzureNode<SiteTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        if (node.treeItem.logStream && node.treeItem.logStream.isConnected) {
            node.treeItem.logStream.dispose();
        } else {
            await vscode.window.showWarningMessage(`The log-streaming service for "${node.treeItem.label}" is already disconnected.`);
        }
    });
    actionHandler.registerCommandWithCustomTelemetry('diagnostics.StartLogPointsSession', async (properties: TelemetryProperties, _measurements: TelemetryMeasurements, node: IAzureNode<SiteTreeItem>) => {
        if (node) {
            const client: WebSiteManagementClient = nodeUtils.getWebSiteClient(node);
            const wizard = new LogPointsSessionWizard(logPointsManager, context, outputChannel, node, client, actionHandler);
            await wizard.run(properties);
        }
    });

    actionHandler.registerCommand('diagnostics.LogPoints.Toggle', async (uri: vscode.Uri) => {
        await logPointsManager.toggleLogpoint(uri);
    });

    actionHandler.registerCommand('diagnostics.LogPoints.OpenScript', openScript);

    actionHandler.registerCommand('appService.showFile', async (node: IAzureNode<FileTreeItem>) => {
        await fileEditor.showEditor(node);
    });

    actionHandler.registerEvent('appService.fileEditor.onDidSaveTextDocument', vscode.workspace.onDidSaveTextDocument, async (trackTelemetry: () => void, doc: vscode.TextDocument) => await fileEditor.onDidSaveTextDocument(trackTelemetry, context.globalState, doc));
}

// tslint:disable-next-line:no-empty
export function deactivate(): void {
}

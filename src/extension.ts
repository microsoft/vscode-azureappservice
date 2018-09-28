/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as opn from 'opn';
import { extname } from 'path';
import * as vscode from 'vscode';
import { AppSettingsTreeItem, AppSettingTreeItem, editScmType, getFile, IFileResult, registerAppServiceExtensionVariables, stopStreamingLogs } from 'vscode-azureappservice';
import { AzureTreeDataProvider, AzureUserInput, IActionContext, IAzureNode, IAzureParentNode, IAzureTreeItem, IAzureUserInput, registerCommand, registerEvent, registerUIExtensionVariables } from 'vscode-azureextensionui';
import TelemetryReporter from 'vscode-extension-telemetry';
import { SiteConfigResource } from '../node_modules/azure-arm-website/lib/models';
import { addCosmosDBConnection } from './commands/connections/addCosmosDBConnection';
import { deleteCosmosDBConnection } from './commands/connections/deleteCosmosDBConnection';
import { deploy } from './commands/deploy';
import { enableFileLogging } from './commands/enableFileLogging';
import { disableRemoteDebug } from './commands/remoteDebug/disableRemoteDebug';
import { startRemoteDebug } from './commands/remoteDebug/startRemoteDebug';
import { startStreamingLogs } from './commands/startStreamingLogs';
import { swapSlots } from './commands/swapSlots';
import { CosmosDBTreeItem } from './explorer/CosmosDBTreeItem';
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
import { getPackageInfo, IPackageInfo } from './utils/IPackageInfo';

// tslint:disable-next-line:export-name
// tslint:disable-next-line:max-func-body-length
export function activate(context: vscode.ExtensionContext): void {
    registerUIExtensionVariables(ext);
    registerAppServiceExtensionVariables(ext);
    ext.context = context;

    const packageInfo: IPackageInfo | undefined = getPackageInfo(context);
    if (packageInfo) {
        ext.reporter = new TelemetryReporter(packageInfo.name, packageInfo.version, packageInfo.aiKey);
        context.subscriptions.push(ext.reporter);
    }

    const ui: IAzureUserInput = new AzureUserInput(context.globalState);
    ext.ui = ui;

    ext.outputChannel = vscode.window.createOutputChannel("Azure App Service");
    context.subscriptions.push(ext.outputChannel);

    const webAppProvider: WebAppProvider = new WebAppProvider();
    const tree = new AzureTreeDataProvider(webAppProvider, 'appService.LoadMore');
    ext.tree = tree;
    context.subscriptions.push(tree);
    context.subscriptions.push(vscode.window.registerTreeDataProvider('azureAppService', tree));

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

    registerCommand('appService.Refresh', async (node?: IAzureNode) => await tree.refresh(node));
    registerCommand('appService.selectSubscriptions', () => vscode.commands.executeCommand("azure-account.selectSubscriptions"));
    registerCommand('appService.LoadMore', async (node: IAzureNode) => await tree.loadMore(node));
    registerCommand('appService.Browse', async (node?: IAzureNode<SiteTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        node.treeItem.browse();
    });
    registerCommand('appService.OpenInPortal', async (node?: IAzureNode) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        // tslint:disable-next-line:no-non-null-assertion
        node.treeItem.contextValue === DeploymentSlotsTreeItem.contextValue ? node.openInPortal(`${node.parent!.id}/deploymentSlots`) : node.openInPortal();
        // the deep link for slots does not follow the conventional pattern of including its parent in the path name so this is how we extract the slot's id
    });
    registerCommand('appService.Start', async (node?: IAzureNode<SiteTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        const treeItem: SiteTreeItem = node.treeItem;
        const startingApp: string = `Starting "${treeItem.client.fullName}"...`;
        const startedApp: string = `"${treeItem.client.fullName}" has been started.`;
        await node.runWithTemporaryDescription("Starting...", async () => {
            ext.outputChannel.appendLine(startingApp);
            await treeItem.client.start();
            ext.outputChannel.appendLine(startedApp);
        });
    });
    registerCommand('appService.Stop', async (node?: IAzureNode<SiteTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        const treeItem: SiteTreeItem = node.treeItem;
        const stoppingApp: string = `Stopping "${treeItem.client.fullName}"...`;
        const stoppedApp: string = `"${treeItem.client.fullName}" has been stopped. App Service plan charges still apply.`;
        await node.runWithTemporaryDescription("Stopping...", async () => {
            ext.outputChannel.appendLine(stoppingApp);
            await treeItem.client.stop();
            ext.outputChannel.appendLine(stoppedApp);
        });

        await logPointsManager.onAppServiceSiteClosed(node.treeItem.client);
    });
    registerCommand('appService.Restart', async (node?: IAzureNode<SiteTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }
        await vscode.commands.executeCommand('appService.Stop', node);
        await vscode.commands.executeCommand('appService.Start', node);
        await logPointsManager.onAppServiceSiteClosed(node.treeItem.client);
    });
    registerCommand('appService.Delete', async (node?: IAzureNode<SiteTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        await node.deleteNode();
    });
    registerCommand('appService.CreateWebApp', async function (this: IActionContext, node?: IAzureParentNode): Promise<void> {
        const deployingToWebApp = 'deployingToWebApp';

        if (!node) {
            node = <IAzureParentNode>await tree.showNodePicker(AzureTreeDataProvider.subscriptionContextValue);
        }

        const createdApp = <IAzureNode<WebAppTreeItem>>await node.createChild(this);
        createdApp.treeItem.client.getSiteConfig().then(
            (createdAppConfig: SiteConfigResource) => {
                this.properties.linuxFxVersion = createdAppConfig.linuxFxVersion ? createdAppConfig.linuxFxVersion : 'undefined';
                this.properties.createdFromDeploy = 'false';
            },
            () => {
                // ignore
            });
        // prompt user to deploy to newly created web app
        if (await vscode.window.showInformationMessage('Deploy to web app?', yesButton, noButton) === yesButton) {
            this.properties[deployingToWebApp] = 'true';
            await deploy(this, false, createdApp);
        } else {
            this.properties[deployingToWebApp] = 'false';
        }
    });
    registerCommand('appService.Deploy', async function (this: IActionContext, target?: vscode.Uri | IAzureNode<WebAppTreeItem> | undefined): Promise<void> {
        await deploy(this, true, target);
    });
    registerCommand('appService.ConfigureDeploymentSource', async (node?: IAzureNode<SiteTreeItem>) => {
        if (!node) {
            node = <IAzureNode<SiteTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }
        await editScmType(node.treeItem.client, node);
    });
    registerCommand('appService.OpenVSTSCD', async (node?: IAzureNode<WebAppTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        node.treeItem.openCdInPortal(node);
    });
    registerCommand('appService.DeploymentScript', async (node?: IAzureNode<WebAppTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            p.report({ message: 'Generating script...' });
            // tslint:disable-next-line:no-non-null-assertion
            await node!.treeItem.generateDeploymentScript(node!);
        });
    });
    registerCommand('appService.CreateSlot', async function (this: IActionContext, node?: IAzureParentNode<DeploymentSlotsTreeItem>): Promise<void> {
        const deployingToDeploymentSlot = 'deployingToDeploymentSlot';

        if (!node) {
            node = <IAzureParentNode<DeploymentSlotsTreeItem>>await tree.showNodePicker(DeploymentSlotsTreeItem.contextValue);
        }

        const createdSlot = <IAzureNode<SiteTreeItem>>await node.createChild(this);

        // prompt user to deploy to newly created web app
        if (await vscode.window.showInformationMessage('Deploy to deployment slot?', yesButton, noButton) === yesButton) {
            this.properties[deployingToDeploymentSlot] = 'true';
            await deploy(this, false, createdSlot);
        } else {
            this.properties[deployingToDeploymentSlot] = 'false';
        }
    });
    registerCommand('appService.SwapSlots', async (node: IAzureNode<DeploymentSlotTreeItem>) => await swapSlots(node));
    registerCommand('appService.appSettings.Add', async (node?: IAzureParentNode<AppSettingsTreeItem>) => {
        if (!node) {
            node = <IAzureParentNode<AppSettingsTreeItem>>await tree.showNodePicker(AppSettingsTreeItem.contextValue);
        }

        await node.createChild();
    });
    registerCommand('appService.appSettings.Edit', async (node?: IAzureNode<AppSettingTreeItem>) => {
        if (!node) {
            node = <IAzureNode<AppSettingTreeItem>>await tree.showNodePicker(AppSettingTreeItem.contextValue);
        }

        await node.treeItem.edit(node);
    });
    registerCommand('appService.appSettings.Rename', async (node?: IAzureNode<AppSettingTreeItem>) => {
        if (!node) {
            node = <IAzureNode<AppSettingTreeItem>>await tree.showNodePicker(AppSettingTreeItem.contextValue);
        }

        await node.treeItem.rename(node);
    });
    registerCommand('appService.appSettings.Delete', async (node?: IAzureNode<AppSettingTreeItem>) => {
        if (!node) {
            node = <IAzureNode<AppSettingTreeItem>>await tree.showNodePicker(AppSettingTreeItem.contextValue);
        }

        await node.deleteNode();
    });
    registerCommand('appService.OpenLogStream', startStreamingLogs);
    registerCommand('appService.StopLogStream', async (node?: IAzureNode<SiteTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        await stopStreamingLogs(node.treeItem.client);
    });
    registerCommand('appService.StartLogPointsSession', async function (this: IActionContext, node?: IAzureNode<SiteTreeItem>): Promise<void> {
        if (node) {
            const wizard = new LogPointsSessionWizard(logPointsManager, context, ext.outputChannel, node, node.treeItem.client);
            await wizard.run(this.properties);
        }
    });

    registerCommand('appService.LogPoints.Toggle', async (uri: vscode.Uri) => {
        await logPointsManager.toggleLogpoint(uri);
    });

    registerCommand('appService.LogPoints.OpenScript', openScript);

    registerCommand('appService.StartRemoteDebug', async (node?: IAzureNode<SiteTreeItem>) => startRemoteDebug(node));
    registerCommand('appService.DisableRemoteDebug', async (node?: IAzureNode<SiteTreeItem>) => disableRemoteDebug(node));

    registerCommand('appService.showFile', async (node: IAzureNode<FileTreeItem>) => {
        const logFiles: string = 'LogFiles/';
        // we don't want to let users save log files, so rather than using the FileEditor, just open an untitled document
        if (node.treeItem.path.startsWith(logFiles)) {
            const file: IFileResult = await getFile(node.treeItem.client, node.treeItem.path);
            const document: vscode.TextDocument = await vscode.workspace.openTextDocument({
                language: extname(node.treeItem.path).substring(1), // remove the prepending dot of the ext
                content: file.data
            });
            await vscode.window.showTextDocument(document);
        } else {
            await fileEditor.showEditor(node);
        }
    });
    registerCommand('appService.ScaleUp', async (node: IAzureNode<DeploymentSlotsNATreeItem | ScaleUpTreeItem>) => {
        node.openInPortal(node.treeItem.scaleUpId);
    });

    registerEvent('appService.fileEditor.onDidSaveTextDocument', vscode.workspace.onDidSaveTextDocument, async function (this: IActionContext, doc: vscode.TextDocument): Promise<void> { await fileEditor.onDidSaveTextDocument(this, context.globalState, doc); });
    registerCommand('appService.EnableFileLogging', async (node?: IAzureNode<SiteTreeItem> | IAzureNode<FolderTreeItem> | IAzureParentNode<IAzureTreeItem>) => {
        if (!node) {
            node = <IAzureNode<SiteTreeItem>>await ext.tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        if (node.treeItem instanceof FolderTreeItem) {
            // If the entry point was the Files/Log Files node, pass the parent as that's where the logic lives
            node = node.parent;
        }
        // tslint:disable-next-line:no-non-null-assertion
        const siteTreeItem: SiteTreeItem = <SiteTreeItem>node!.treeItem;
        const isEnabled = await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            p.report({ message: 'Checking container diagnostics settings...' });
            return await siteTreeItem.isHttpLogsEnabled();
        });

        if (!isEnabled) {
            await enableFileLogging(<IAzureNode<SiteTreeItem>>node);
        } else {
            // tslint:disable-next-line:no-non-null-assertion
            vscode.window.showInformationMessage(`File logging has already been enabled for ${siteTreeItem.client.fullName}.`);
        }
    });
    registerCommand('appService.InstallCosmosDBExtension', async () => {
        const commandToRun = 'extension.open';
        const listOfCommands = await vscode.commands.getCommands();
        if (listOfCommands.find((x: string) => x === commandToRun)) {
            vscode.commands.executeCommand(commandToRun, 'ms-azuretools.vscode-cosmosdb');
        } else {
            // tslint:disable-next-line:no-unsafe-any
            opn('https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-cosmosdb');
        }
    });
    registerCommand('appService.AddCosmosDBConnection', async (node: IAzureNode<CosmosDBTreeItem>) => {
        const connectionToAdd = <string>await vscode.commands.executeCommand('cosmosDB.api.getDatabase');
        await addCosmosDBConnection(node, connectionToAdd);
    });
    registerCommand('appService.DeleteCosmosDBConnection', deleteCosmosDBConnection);
}

// tslint:disable-next-line:no-empty
export function deactivate(): void {
}

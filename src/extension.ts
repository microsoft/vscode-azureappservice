/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as opn from 'opn';
import { extname } from 'path';
import * as vscode from 'vscode';
import { AppSettingsTreeItem, AppSettingTreeItem, DeploymentsTreeItem, editScmType, getFile, IFileResult, ISiteTreeRoot, registerAppServiceExtensionVariables, SiteClient, stopStreamingLogs } from 'vscode-azureappservice';
import { AzureParentTreeItem, AzureTreeDataProvider, AzureTreeItem, AzureUserInput, createTelemetryReporter, IActionContext, IAzureUserInput, registerCommand, registerEvent, registerUIExtensionVariables, SubscriptionTreeItem } from 'vscode-azureextensionui';
import { SiteConfigResource } from '../node_modules/azure-arm-website/lib/models';
import { addCosmosDBConnection } from './commands/connections/addCosmosDBConnection';
import { removeCosmosDBConnection } from './commands/connections/removeCosmosDBConnection';
import { revealConnectionInAppSettings } from './commands/connections/revealConnectionInAppSettings';
import { deploy } from './commands/deploy';
import { connectToGitHub } from './commands/deployments/connectToGitHub';
import { disconnectRepo } from './commands/deployments/disconnectRepo';
import { redeployDeployment } from './commands/deployments/redeployDeployment';
import { viewDeploymentLogs } from './commands/deployments/viewDeploymentLogs';
import { enableFileLogging } from './commands/enableFileLogging';
import { disableRemoteDebug } from './commands/remoteDebug/disableRemoteDebug';
import { startRemoteDebug } from './commands/remoteDebug/startRemoteDebug';
import { startStreamingLogs } from './commands/startStreamingLogs';
import { swapSlots } from './commands/swapSlots';
import { CosmosDBConnection } from './explorer/CosmosDBConnection';
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

// tslint:disable-next-line:export-name
// tslint:disable-next-line:max-func-body-length
export function activate(context: vscode.ExtensionContext): void {
    ext.context = context;
    ext.reporter = createTelemetryReporter(context);

    const ui: IAzureUserInput = new AzureUserInput(context.globalState);
    ext.ui = ui;

    ext.outputChannel = vscode.window.createOutputChannel("Azure App Service");
    context.subscriptions.push(ext.outputChannel);

    registerUIExtensionVariables(ext);
    registerAppServiceExtensionVariables(ext);

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

    registerCommand('appService.Refresh', async (node?: AzureTreeItem) => await tree.refresh(node));
    registerCommand('appService.selectSubscriptions', () => vscode.commands.executeCommand("azure-account.selectSubscriptions"));
    registerCommand('appService.LoadMore', async (node: AzureTreeItem) => await tree.loadMore(node));
    registerCommand('appService.Browse', async (node?: SiteTreeItem) => {
        if (!node) {
            node = <WebAppTreeItem>await tree.showTreeItemPicker(WebAppTreeItem.contextValue);
        }

        node.browse();
    });
    registerCommand('appService.OpenInPortal', async (node?: AzureTreeItem<ISiteTreeRoot>) => {
        if (!node) {
            node = <WebAppTreeItem>await tree.showTreeItemPicker(WebAppTreeItem.contextValue);
        }

        switch (node.contextValue) {
            // the deep link for slots does not follow the conventional pattern of including its parent in the path name so this is how we extract the slot's id
            case DeploymentSlotsTreeItem.contextValue:
                // tslint:disable-next-line:no-non-null-assertion
                node.openInPortal(`${node.parent!.fullId}/deploymentSlots`);
                return;
            // the deep link for "Deployments" do not follow the conventional pattern of including its parent in the path name so we need to pass the "Deployment Center" url directly
            case DeploymentsTreeItem.contextValueConnected:
            case DeploymentsTreeItem.contextValueUnconnected:
                node.openInPortal(`${node.root.client.id}/vstscd`);
                return;
            default:
                node.openInPortal();
                return;
        }
    });
    registerCommand('appService.Start', async (node?: SiteTreeItem) => {
        if (!node) {
            node = <WebAppTreeItem>await tree.showTreeItemPicker(WebAppTreeItem.contextValue);
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
            node = <WebAppTreeItem>await tree.showTreeItemPicker(WebAppTreeItem.contextValue);
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
            node = <WebAppTreeItem>await tree.showTreeItemPicker(WebAppTreeItem.contextValue);
        }
        await vscode.commands.executeCommand('appService.Stop', node);
        await vscode.commands.executeCommand('appService.Start', node);
        await logPointsManager.onAppServiceSiteClosed(node.root.client);
    });
    registerCommand('appService.Delete', async (node?: SiteTreeItem) => {
        if (!node) {
            node = <WebAppTreeItem>await tree.showTreeItemPicker(WebAppTreeItem.contextValue);
        }

        await node.deleteTreeItem();
    });
    registerCommand('appService.CreateWebApp', async function (this: IActionContext, node?: AzureParentTreeItem): Promise<void> {
        const deployingToWebApp = 'deployingToWebApp';

        if (!node) {
            node = <AzureParentTreeItem>await tree.showTreeItemPicker(SubscriptionTreeItem.contextValue);
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
        if (await vscode.window.showInformationMessage('Deploy to web app?', yesButton, noButton) === yesButton) {
            this.properties[deployingToWebApp] = 'true';
            await deploy(this, false, createdApp);
        } else {
            this.properties[deployingToWebApp] = 'false';
        }
    });
    registerCommand('appService.Deploy', async function (this: IActionContext, target?: vscode.Uri | WebAppTreeItem | undefined): Promise<void> {
        await deploy(this, true, target);
    });
    registerCommand('appService.ConfigureDeploymentSource', async function (this: IActionContext, node?: SiteTreeItem): Promise<void> {
        if (!node) {
            node = <SiteTreeItem>await tree.showTreeItemPicker(WebAppTreeItem.contextValue);
        }
        await editScmType(node.root.client, node, this);
    });
    registerCommand('appService.OpenVSTSCD', async (node?: WebAppTreeItem) => {
        if (!node) {
            node = <WebAppTreeItem>await tree.showTreeItemPicker(WebAppTreeItem.contextValue);
        }

        node.openCdInPortal();
    });
    registerCommand('appService.DeploymentScript', async (node?: WebAppTreeItem) => {
        if (!node) {
            node = <WebAppTreeItem>await tree.showTreeItemPicker(WebAppTreeItem.contextValue);
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
            node = <DeploymentSlotsTreeItem>await tree.showTreeItemPicker(DeploymentSlotsTreeItem.contextValue);
        }

        const createdSlot = <SiteTreeItem>await node.createChild(this);

        // prompt user to deploy to newly created web app
        if (await vscode.window.showInformationMessage('Deploy to deployment slot?', yesButton, noButton) === yesButton) {
            this.properties[deployingToDeploymentSlot] = 'true';
            await deploy(this, false, createdSlot);
        } else {
            this.properties[deployingToDeploymentSlot] = 'false';
        }
    });
    registerCommand('appService.SwapSlots', async (node: DeploymentSlotTreeItem) => await swapSlots(node));
    registerCommand('appService.appSettings.Add', async (node?: AppSettingsTreeItem) => {
        if (!node) {
            node = <AppSettingsTreeItem>await tree.showTreeItemPicker(AppSettingsTreeItem.contextValue);
        }

        await node.createChild();
    });
    registerCommand('appService.appSettings.Edit', async (node?: AppSettingTreeItem) => {
        if (!node) {
            node = <AppSettingTreeItem>await tree.showTreeItemPicker(AppSettingTreeItem.contextValue);
        }

        await node.edit();
    });
    registerCommand('appService.appSettings.Rename', async (node?: AppSettingTreeItem) => {
        if (!node) {
            node = <AppSettingTreeItem>await tree.showTreeItemPicker(AppSettingTreeItem.contextValue);
        }

        await node.rename();
    });
    registerCommand('appService.appSettings.Delete', async (node?: AppSettingTreeItem) => {
        if (!node) {
            node = <AppSettingTreeItem>await tree.showTreeItemPicker(AppSettingTreeItem.contextValue);
        }

        await node.deleteTreeItem();
    });
    registerCommand('appService.OpenLogStream', startStreamingLogs);
    registerCommand('appService.StopLogStream', async (node?: SiteTreeItem) => {
        if (!node) {
            node = <WebAppTreeItem>await tree.showTreeItemPicker(WebAppTreeItem.contextValue);
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

    registerCommand('appService.StartRemoteDebug', async (node?: SiteTreeItem) => startRemoteDebug(node));
    registerCommand('appService.DisableRemoteDebug', async (node?: SiteTreeItem) => disableRemoteDebug(node));

    registerCommand('appService.showFile', async (node: FileTreeItem) => {
        // we don't want to let users save log files, so rather than using the FileEditor, just open an untitled document
        if (node.path.toLowerCase().match(/logfiles(\/|\\)/g)) {
            const file: IFileResult = await getFile(node.root.client, node.path);
            const document: vscode.TextDocument = await vscode.workspace.openTextDocument({
                language: extname(node.path).substring(1), // remove the prepending dot of the ext
                content: file.data
            });
            await vscode.window.showTextDocument(document);
        } else {
            await fileEditor.showEditor(node);
        }
    });
    registerCommand('appService.ScaleUp', async (node: DeploymentSlotsNATreeItem | ScaleUpTreeItem) => {
        node.openInPortal(node.scaleUpId);
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
            // tslint:disable-next-line:no-unsafe-any
            opn('https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-cosmosdb');
        }
    });
    registerCommand('appService.AddCosmosDBConnection', addCosmosDBConnection);
    registerCommand('appService.RemoveCosmosDBConnection', removeCosmosDBConnection);
    registerCommand('appService.RevealConnection', async (node: CosmosDBConnection) => await node.cosmosExtensionItem.reveal());
    registerCommand('appService.RevealConnectionInAppSettings', revealConnectionInAppSettings); registerCommand('appService.ViewDeploymentLogs', viewDeploymentLogs);
    registerCommand('appService.Redeploy', redeployDeployment);
    registerCommand('appService.DisconnectRepo', disconnectRepo);
    registerCommand('appService.ConnectToGitHub', connectToGitHub);
}

// tslint:disable-next-line:no-empty
export function deactivate(): void {
}

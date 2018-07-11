/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as fs from 'fs-extra';
import { join } from 'path';
import { extname } from 'path';
import * as vscode from 'vscode';
import { AppSettingsTreeItem, AppSettingTreeItem, editScmType, getFile, IFileResult, registerAppServiceExtensionVariables } from 'vscode-azureappservice';
import { AzureTreeDataProvider, AzureUserInput, IActionContext, IAzureNode, IAzureParentNode, IAzureUserInput, parseError, registerCommand, registerEvent, registerUIExtensionVariables } from 'vscode-azureextensionui';
import TelemetryReporter from 'vscode-extension-telemetry';
import { disableRemoteDebug } from './commands/remoteDebug/disableRemoteDebug';
import { startRemoteDebug } from './commands/remoteDebug/startRemoteDebug';
import { swapSlots } from './commands/swapSlots';
import * as constants from './constants';
import { extensionPrefix } from './constants';
import { DeploymentSlotsTreeItem } from './explorer/DeploymentSlotsTreeItem';
import { DeploymentSlotTreeItem } from './explorer/DeploymentSlotTreeItem';
import { FileEditor } from './explorer/editors/FileEditor';
import { FileTreeItem } from './explorer/FileTreeItem';
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
import { isPathEqual } from './utils/pathUtils';

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
            await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: startingApp }, async (): Promise<void> => {
                ext.outputChannel.appendLine(startingApp);
                await treeItem.client.start();
                ext.outputChannel.appendLine(startedApp);
                vscode.window.showInformationMessage(startedApp);
            });
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
            await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: stoppingApp }, async (): Promise<void> => {
                ext.outputChannel.appendLine(stoppingApp);
                await treeItem.client.stop();
                ext.outputChannel.appendLine(stoppedApp);
                vscode.window.showInformationMessage(stoppedApp);
            });
        });

        await logPointsManager.onAppServiceSiteClosed(node.treeItem.client);
    });
    registerCommand('appService.Restart', async (node?: IAzureNode<SiteTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        const treeItem: SiteTreeItem = node.treeItem;
        const restartingApp: string = `Restarting "${treeItem.client.fullName}"...`;
        const restartedApp: string = `"${treeItem.client.fullName}" has been restarted.`;
        await node.runWithTemporaryDescription("Restarting...", async () => {
            await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: restartingApp }, async (): Promise<void> => {
                ext.outputChannel.appendLine(restartingApp);
                await treeItem.client.stop();
                await treeItem.client.start();
                // tslint:disable-next-line:no-non-null-assertion
                await node!.refresh();
                vscode.window.showInformationMessage(restartedApp);
                ext.outputChannel.appendLine(restartedApp);
            });
        });

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

        // prompt user to deploy to newly created web app
        if (await vscode.window.showInformationMessage('Deploy to web app?', yesButton, noButton) === yesButton) {
            this.properties[deployingToWebApp] = 'true';
            await vscode.commands.executeCommand('appService.Deploy', createdApp);
        } else {
            this.properties[deployingToWebApp] = 'false';
        }
    });
    registerCommand('appService.Deploy', async function (this: IActionContext, target?: vscode.Uri | IAzureNode<WebAppTreeItem> | undefined): Promise<void> {
        let node: IAzureNode<WebAppTreeItem> | undefined;
        const newNodes: IAzureNode<WebAppTreeItem>[] = [];
        let fsPath: string | undefined;
        let confirmDeployment: boolean = true;
        this.properties.deployedWithConfigs = 'false';
        const onNodeCreatedFromQuickPickDisposable: vscode.Disposable = tree.onNodeCreate((newNode: IAzureNode<WebAppTreeItem>) => {
            // event is fired from azure-extensionui if node was created during deployment
            newNodes.push(newNode);
        });
        try {
            if (target instanceof vscode.Uri) {
                fsPath = target.fsPath;
                this.properties.deploymentEntryPoint = constants.deploymentEntryPoint.fileExplorerContextMenu;
            } else {
                this.properties.deploymentEntryPoint = target ? constants.deploymentEntryPoint.webAppContextMenu : constants.deploymentEntryPoint.deployButton;
                node = target;
            }

            // default deployment configuration logic starts here:
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length === 1) {
                // only use the deployToWebAppId is there is only one workspace opened
                const activeWorkspace: vscode.WorkspaceFolder = vscode.workspace.workspaceFolders[0];
                const deployToWebAppId: string | undefined = vscode.workspace.getConfiguration(constants.extensionPrefix, activeWorkspace.uri).get(constants.configurationSettings.deployToWebAppId);
                if (deployToWebAppId && deployToWebAppId !== constants.neverSaveDeploymentConfiguration) {
                    const deploySubpath: string | undefined = vscode.workspace.getConfiguration(constants.extensionPrefix, activeWorkspace.uri).get(constants.configurationSettings.deploySubpath);
                    const deployPath: string = deploySubpath ? await join(activeWorkspace.uri.fsPath, deploySubpath) : activeWorkspace.uri.fsPath;
                    const pathExists: boolean = await fs.pathExists(deployPath);
                    const nodeFromConfig: IAzureNode<WebAppTreeItem> | undefined = <IAzureNode<WebAppTreeItem>>await ext.tree.findNode(deployToWebAppId); // resolves to undefined if app can't be found
                    // tslint:disable-next-line:strict-boolean-expressions
                    if (pathExists && nodeFromConfig) {
                        // tslint:disable-next-line:strict-boolean-expressions
                        if ((!fsPath || isPathEqual(fsPath, deployPath)) && (!node || node.id === nodeFromConfig.id)) {
                            /*
                            * only use the deployConfig in the following situation:
                            * if there is no fsPath and no node, then the entry point was the deploy button
                            * if the target is a node and it matches the id in the deployConfig
                            * if the target is a fsPath and it matches the deployPath
                            **/
                            fsPath = deployPath;
                            node = nodeFromConfig;
                            this.properties.deployedWithConfigs = 'true';
                        }
                    } else {
                        // if path or app cannot be found, delete old settings and prompt user to save after deployment
                        vscode.workspace.getConfiguration(constants.extensionPrefix, vscode.workspace.workspaceFolders[0].uri).update(constants.configurationSettings.deployToWebAppId, undefined);
                    }
                }
            }
            // end of default deployment configuration logic

            if (!node) {
                try {
                    node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);

                } catch (err2) {
                    if (parseError(err2).isUserCancelledError) {
                        this.properties.cancelStep = `showNodePicker:${WebAppTreeItem.contextValue}`;
                    }
                    throw err2;
                }
            }

            if (newNodes.length > 0) {
                for (const newApp of newNodes) {
                    if (newApp.id === node.id) {
                        // if the node selected for deployment is the same newly created nodes, stifle the confirmDeployment dialog
                        confirmDeployment = false;
                    }
                }
            }
            await node.treeItem.deploy(node, fsPath, extensionPrefix, confirmDeployment, this.properties);
        } finally {
            onNodeCreatedFromQuickPickDisposable.dispose();
        }
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
            await createdSlot.treeItem.deploy(createdSlot, undefined, extensionPrefix, false, this.properties);
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
    registerCommand('appService.OpenLogStream', async (node?: IAzureNode<SiteTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        if (node.treeItem.logStream && node.treeItem.logStream.isConnected) {
            // tslint:disable-next-line:no-non-null-assertion
            node.treeItem.logStreamOutputChannel!.show();
            await vscode.window.showWarningMessage(`The log-streaming service for "${node.treeItem.client.fullName}" is already active.`);
        } else {
            const enableButton: vscode.MessageItem = { title: 'Yes' };
            const isEnabled = await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
                p.report({ message: 'Checking container diagnostics settings...' });
                // tslint:disable-next-line:no-non-null-assertion
                return await node!.treeItem.isHttpLogsEnabled();
            });

            if (!isEnabled) {
                await ui.showWarningMessage(`Do you want to enable application logging for ${node.treeItem.client.fullName}? The web app will be restarted.`, { modal: true }, enableButton);
                const enablingLogging: string = `Enabling Logging for "${node.treeItem.client.fullName}"...`;
                const enabledLogging: string = `Enabled Logging for "${node.treeItem.client.fullName}"...`;
                await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: enablingLogging }, async (): Promise<void> => {
                    ext.outputChannel.appendLine(enablingLogging);
                    // tslint:disable-next-line:no-non-null-assertion
                    await node!.treeItem.enableHttpLogs();
                    await vscode.commands.executeCommand('appService.Restart', node);
                    vscode.window.showInformationMessage(enabledLogging);
                    ext.outputChannel.appendLine(enabledLogging);
                });

            }

            node.treeItem.logStream = await node.treeItem.connectToLogStream();
        }
    });
    registerCommand('appService.StopLogStream', async (node?: IAzureNode<SiteTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        if (node.treeItem.logStream && node.treeItem.logStream.isConnected) {
            node.treeItem.logStream.dispose();
        } else {
            await vscode.window.showWarningMessage(`The log-streaming service for "${node.treeItem.label}" is already disconnected.`);
        }
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

    registerEvent('appService.fileEditor.onDidSaveTextDocument', vscode.workspace.onDidSaveTextDocument, async function (this: IActionContext, doc: vscode.TextDocument): Promise<void> { await fileEditor.onDidSaveTextDocument(this, context.globalState, doc); });
}

// tslint:disable-next-line:no-empty
export function deactivate(): void {
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import WebSiteManagementClient = require('azure-arm-website');
import * as vscode from 'vscode';
import { AppSettingsTreeItem, AppSettingTreeItem } from 'vscode-azureappservice';
import { AzureTreeDataProvider, IAzureNode, IAzureParentNode, UserCancelledError } from 'vscode-azureextensionui';
import { DeploymentSlotSwapper } from './DeploymentSlotSwapper';
import { LogPointsManager } from './diagnostics/LogPointsManager';
import { LogPointsSessionWizard } from './diagnostics/LogPointsSessionWizard';
import { RemoteScriptDocumentProvider, RemoteScriptSchema } from './diagnostics/remoteScriptDocumentProvider';
import { LogpointsCollection } from './diagnostics/structs/LogpointsCollection';
import { ErrorData } from './ErrorData';
import { SiteActionError, WizardFailedError } from './errors';
import { DeploymentSlotsTreeItem } from './explorer/DeploymentSlotsTreeItem';
import { DeploymentSlotTreeItem } from './explorer/DeploymentSlotTreeItem';
import { LoadedScriptsProvider, openScript } from './explorer/loadedScriptsExplorer';
import { getAppServicePlan, SiteTreeItem } from './explorer/SiteTreeItem';
import { WebAppProvider } from './explorer/WebAppProvider';
import { WebAppTreeItem } from './explorer/WebAppTreeItem';
import { Reporter } from './telemetry/reporter';
import * as util from "./util";
import { nodeUtils } from './utils/nodeUtils';
import { FileTreeItem } from './explorer/FileTreeItem';
import { FileEditor } from './explorer/editors/FileEditor'

// tslint:disable-next-line:max-func-body-length
// tslint:disable-next-line:export-name
export function activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(new Reporter(context));

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

    initCommand(context, 'appService.Refresh', (node?: IAzureNode) => tree.refresh(node));
    initCommand(context, 'appService.LoadMore', (node?: IAzureNode) => tree.loadMore(node));
    initAsyncCommand(context, 'appService.Browse', async (node: IAzureNode<SiteTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        node.treeItem.browse();
    });
    initAsyncCommand(context, 'appService.OpenInPortal', async (node: IAzureNode) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        node.openInPortal();
    });
    initAsyncCommand(context, 'appService.Start', async (node: IAzureNode<SiteTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        const siteType = util.isSiteDeploymentSlot(node.treeItem.site) ? 'Deployment Slot' : 'Web App';
        outputChannel.show();
        outputChannel.appendLine(`Starting ${siteType} "${node.treeItem.site.name}"...`);
        await node.treeItem.start(nodeUtils.getWebSiteClient(node));
        node.refresh();
        outputChannel.appendLine(`${siteType} "${node.treeItem.site.name}" has been started.`);
    });
    initAsyncCommand(context, 'appService.Stop', async (node: IAzureNode<SiteTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        const siteType = util.isSiteDeploymentSlot(node.treeItem.site) ? 'Deployment Slot' : 'Web App';
        outputChannel.show();
        outputChannel.appendLine(`Stopping ${siteType} "${node.treeItem.site.name}"...`);
        await node.treeItem.stop(nodeUtils.getWebSiteClient(node));
        node.refresh();
        outputChannel.appendLine(`${siteType} "${node.treeItem.site.name}" has been stopped. App Service plan charges still apply.`);

        logPointsManager.onAppServiceSiteClosed(node.treeItem.site);
    });
    initAsyncCommand(context, 'appService.Restart', async (node: IAzureNode<SiteTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        const client: WebSiteManagementClient = nodeUtils.getWebSiteClient(node);
        const siteType = util.isSiteDeploymentSlot(node.treeItem.site) ? 'Deployment Slot' : 'Web App';
        outputChannel.show();
        outputChannel.appendLine(`Restarting ${siteType} "${node.treeItem.site.name}"...`);
        await node.treeItem.siteWrapper.stop(client);
        await node.treeItem.siteWrapper.start(client);
        node.refresh();
        outputChannel.appendLine(`${siteType} "${node.treeItem.site.name}" has been restarted.`);

        logPointsManager.onAppServiceSiteClosed(node.treeItem.site);
    });
    initAsyncCommand(context, 'appService.Delete', async (node: IAzureNode<SiteTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        await node.deleteNode();
    });
    initAsyncCommand(context, 'appService.CreateWebApp', async (node?: IAzureParentNode) => {
        if (!node) {
            node = <IAzureParentNode>await tree.showNodePicker(AzureTreeDataProvider.subscriptionContextValue);
        }

        const createdApp = <IAzureNode<WebAppTreeItem>>await node.createChild();

        // prompt user to deploy to newly created web app
        const yesButton: vscode.MessageItem = { title: 'Yes' };
        const noButton: vscode.MessageItem = { title: 'No', isCloseAffordance: true };
        if (await vscode.window.showInformationMessage('Deploy to web app?', yesButton, noButton)) {
            const fsPath = (await util.showWorkspaceFoldersQuickPick("Select the folder to deploy")).uri.fsPath;
            const client = nodeUtils.getWebSiteClient(createdApp);
            await createdApp.treeItem.siteWrapper.deploy(fsPath, client, outputChannel, 'appService', false);
        }
    });
    initAsyncCommand(context, 'appService.Deploy', async (target?: vscode.Uri | IAzureNode<WebAppTreeItem> | undefined) => {
        let node: IAzureNode<WebAppTreeItem>;
        let fsPath: string;
        if (target instanceof vscode.Uri) {
            fsPath = target.fsPath;
        } else {
            fsPath = (await util.showWorkspaceFoldersQuickPick("Select the folder to deploy")).uri.fsPath;
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
            throw new SiteActionError(err, appServicePlan.sku.size);
        }
    });
    initAsyncCommand(context, 'appService.ConfigureDeploymentSource', async (node: IAzureNode<SiteTreeItem>) => {
        if (!node) {
            node = <IAzureNode<SiteTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }
        const updatedScmType = await node.treeItem.editScmType(nodeUtils.getWebSiteClient(node));
        outputChannel.appendLine(`Deployment source for "${node.treeItem.site.name}" has been updated to "${updatedScmType}".`);
    });
    initAsyncCommand(context, 'appService.OpenVSTSCD', async (node?: IAzureNode<WebAppTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        node.treeItem.openCdInPortal(node);
    });
    initAsyncCommand(context, 'appService.DeploymentScript', async (node: IAzureNode<WebAppTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, p => {
            p.report({ message: 'Generating script...' });
            return node.treeItem.generateDeploymentScript(node);
        });
    });
    initAsyncCommand(context, 'deploymentSlots.CreateSlot', async (node: IAzureParentNode<DeploymentSlotsTreeItem>) => {
        if (!node) {
            node = <IAzureParentNode<DeploymentSlotsTreeItem>>await tree.showNodePicker(DeploymentSlotsTreeItem.contextValue);
        }

        const createdSlot = <IAzureNode<SiteTreeItem>>await node.createChild();

        // prompt user to deploy to newly created web app
        const yesButton: vscode.MessageItem = { title: 'Yes' };
        const noButton: vscode.MessageItem = { title: 'No', isCloseAffordance: true };
        if (await vscode.window.showInformationMessage('Deploy to deployment slot?', yesButton, noButton)) {
            const fsPath = (await util.showWorkspaceFoldersQuickPick("Select the folder to deploy")).uri.fsPath;
            const client = nodeUtils.getWebSiteClient(createdSlot);
            await createdSlot.treeItem.siteWrapper.deploy(fsPath, client, outputChannel, 'appService', false);
        }
    });
    initAsyncCommand(context, 'deploymentSlot.SwapSlots', async (node: IAzureNode<DeploymentSlotTreeItem>) => {
        if (!node) {
            node = <IAzureParentNode<DeploymentSlotTreeItem>>await tree.showNodePicker(DeploymentSlotTreeItem.contextValue);
        }

        const wizard = new DeploymentSlotSwapper(outputChannel, node);
        await wizard.run();
    });
    initAsyncCommand(context, 'appSettings.Add', async (node: IAzureParentNode<AppSettingsTreeItem>) => {
        if (!node) {
            node = <IAzureParentNode<AppSettingsTreeItem>>await tree.showNodePicker(AppSettingsTreeItem.contextValue);
        }

        await node.createChild();
    });
    initAsyncCommand(context, 'appSettings.Edit', async (node: IAzureNode<AppSettingTreeItem>) => {
        if (!node) {
            node = <IAzureNode<AppSettingTreeItem>>await tree.showNodePicker(AppSettingTreeItem.contextValue);
        }

        await node.treeItem.edit(node);
    });
    initAsyncCommand(context, 'appSettings.Rename', async (node: IAzureNode<AppSettingTreeItem>) => {
        if (!node) {
            node = <IAzureNode<AppSettingTreeItem>>await tree.showNodePicker(AppSettingTreeItem.contextValue);
        }

        await node.treeItem.rename(node);
    });
    initAsyncCommand(context, 'appSettings.Delete', async (node: IAzureNode<AppSettingTreeItem>) => {
        if (!node) {
            node = <IAzureNode<AppSettingTreeItem>>await tree.showNodePicker(AppSettingTreeItem.contextValue);
        }

        await node.deleteNode();
    });
    initAsyncCommand(context, 'diagnostics.OpenLogStream', async (node: IAzureNode<SiteTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        const client: WebSiteManagementClient = nodeUtils.getWebSiteClient(node);
        const enableButton: vscode.MessageItem = { title: 'Yes' };
        const notNowButton: vscode.MessageItem = { title: 'Not Now', isCloseAffordance: true };
        const isEnabled = await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, p => {
            p.report({ message: 'Checking container diagnostics settings...' });
            return node.treeItem.isHttpLogsEnabled(client);
        });

        if (!isEnabled && enableButton === await vscode.window.showWarningMessage('Do you want to enable logging and restart this container?', enableButton, notNowButton)) {
            outputChannel.show();
            outputChannel.appendLine(`Enabling Logging for "${node.treeItem.site.name}"...`);
            await node.treeItem.enableHttpLogs(client);
            await vscode.commands.executeCommand('appService.Restart', node);
        }
        // Otherwise connect to log stream anyways, users might see similar "log not enabled" message with how to enable link from the stream output.
        await node.treeItem.connectToLogStream(client, context);
    });
    initAsyncCommand(context, 'diagnostics.StopLogStream', async (node: IAzureNode<SiteTreeItem>) => {
        if (!node) {
            node = <IAzureNode<WebAppTreeItem>>await tree.showNodePicker(WebAppTreeItem.contextValue);
        }

        node.treeItem.stopLogStream();
    });
    initAsyncCommand(context, 'diagnostics.StartLogPointsSession', async (node: IAzureNode<SiteTreeItem>) => {
        if (node) {
            const client: WebSiteManagementClient = nodeUtils.getWebSiteClient(node);
            const wizard = new LogPointsSessionWizard(outputChannel, node, client);
            await wizard.run();
        }
    });

    initAsyncCommand(context, 'diagnostics.LogPoints.Toggle', async (uri: vscode.Uri) => {
        await logPointsManager.toggleLogpoint(uri);
    });

    initCommand(context, 'diagnostics.LogPoints.OpenScript', openScript);

    initAsyncCommand(context, 'appService.showFile', async (node: IAzureNode<FileTreeItem>) => {
        await fileEditor.showEditor(node);
    });

    initEvent(context, 'appService.fileEditor.onDidSaveTextDocument', vscode.workspace.onDidSaveTextDocument, (doc: vscode.TextDocument) => fileEditor.onDidSaveTextDocument(context.globalState, doc));


}


// tslint:disable-next-line:no-empty
export function deactivate(): void {
}

function initEvent<T>(context: vscode.ExtensionContext, eventId: string, event: vscode.Event<T>, callback: (...args: any[]) => any) {

    context.subscriptions.push(event(wrapAsyncCallback(eventId, (...args: any[]) => Promise.resolve(callback(...args)))));

}

// tslint:disable-next-line:no-any
function initCommand(extensionContext: vscode.ExtensionContext, commandId: string, callback: (...args: any[]) => void): void {

    initAsyncCommand(extensionContext, commandId, async (...args: any[]) => callback(...args));
}

// tslint:disable-next-line:no-any
function initAsyncCommand(context: vscode.ExtensionContext, commandId: string, callback: (...args: any[]) => Promise<any>) {
    context.subscriptions.push(vscode.commands.registerCommand(commandId, wrapAsyncCallback(commandId, callback)));
}


function wrapAsyncCallback(commandId, callback: (...args: any[]) => Promise<any>): (...args: any[]) => Promise<any> {
    return async (...args: any[]) => {
        const start = Date.now();
        const properties: { [key: string]: string; } = {};
        properties.result = 'Succeeded';
        let errorData: ErrorData | undefined;
        const output = util.getOutputChannel();

        try {
            await callback(...args)
        }
        } catch (err) {
        if (err instanceof SiteActionError) {
            properties.servicePlan = err.servicePlanSize;
        }

        if (err instanceof WizardFailedError) {
            properties.stepTitle = err.stepTitle;
            properties.stepIndex = err.stepIndex.toString();
        }

        if (err instanceof UserCancelledError) {
            properties.result = 'Canceled';
        } else {
            properties.result = 'Failed';
            errorData = new ErrorData(err);
            output.appendLine(`Error: ${errorData.message}`);
            if (errorData.message.includes('\n')) {
                output.show();
                vscode.window.showErrorMessage('An error has occured. Check output window for more details.');
            } else {
                vscode.window.showErrorMessage(errorData.message);
            }

        }
    } finally {
        if (errorData) {
            properties.error = errorData.errorType;
            properties.errorMessage = errorData.message;
        }
        const end = Date.now();
        util.sendTelemetry(commandId, properties, { duration: (end - start) / 1000 });
    }
};
}

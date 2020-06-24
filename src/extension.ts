/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as path from 'path';
import * as vscode from 'vscode';
import { registerAppServiceExtensionVariables } from 'vscode-azureappservice';
import { AzExtTreeDataProvider, AzureUserInput, callWithTelemetryAndErrorHandling, createApiProvider, createAzExtOutputChannel, IActionContext, IAzureUserInput, registerUIExtensionVariables } from 'vscode-azureextensionui';
import { AzureExtensionApi, AzureExtensionApiProvider } from 'vscode-azureextensionui/api';
import { AppServiceFileSystem } from './AppServiceFileSystem';
import { revealTreeItem } from './commands/api/revealTreeItem';
import { ImportTrialAppUriHandler } from './commands/ImportTrialAppUriHandler';
import { registerCommands } from './commands/registerCommands';
import { AzureAccountTreeItem } from './explorer/AzureAccountTreeItem';
import { ext } from './extensionVariables';
import { getResourcesPath } from './utils/pathUtils';

// tslint:disable-next-line:export-name
// tslint:disable-next-line:max-func-body-length
export async function activateInternal(
    context: vscode.ExtensionContext,
    perfStats: {
        loadStartTime: number, loadEndTime: number
    },
    ignoreBundle?: boolean
): Promise<AzureExtensionApiProvider> {
    ext.context = context;
    ext.ignoreBundle = ignoreBundle;

    const ui: IAzureUserInput = new AzureUserInput(context.globalState);
    ext.ui = ui;

    ext.outputChannel = createAzExtOutputChannel("Azure App Service", ext.prefix);
    context.subscriptions.push(ext.outputChannel);

    registerUIExtensionVariables(ext);
    registerAppServiceExtensionVariables(ext);

    await callWithTelemetryAndErrorHandling('appService.activate', async (activateContext: IActionContext) => {
        activateContext.telemetry.properties.isActivationEvent = 'true';
        activateContext.telemetry.measurements.mainFileLoad = (perfStats.loadEndTime - perfStats.loadStartTime) / 1000;

        ext.azureAccountTreeItem = new AzureAccountTreeItem();
        context.subscriptions.push(ext.azureAccountTreeItem);
        ext.tree = new AzExtTreeDataProvider(ext.azureAccountTreeItem, 'appService.LoadMore');

        ext.treeView = vscode.window.createTreeView('azureAppService', { treeDataProvider: ext.tree, showCollapseAll: true });
        context.subscriptions.push(ext.treeView);

        ext.fileSystem = new AppServiceFileSystem(ext.tree);
        context.subscriptions.push(vscode.workspace.registerFileSystemProvider(AppServiceFileSystem.scheme, ext.fileSystem));

        vscode.window.registerUriHandler(new ImportTrialAppUriHandler());
        const tutorialUri: vscode.Uri = vscode.Uri.parse(path.join(getResourcesPath(), 'TrialApp.didact.md'));
        vscode.commands.executeCommand('vscode.didact.register', 'Azure App Service Trial', tutorialUri, 'Azure');

        registerCommands();
    });

    return createApiProvider([<AzureExtensionApi>{
        revealTreeItem,
        apiVersion: '1.0.0'
    }]);
}

// tslint:disable-next-line:no-empty
export function deactivateInternal(): void {
}

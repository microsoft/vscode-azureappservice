/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import { AppServiceDataProvider } from './appServiceExplorer';
import { AppServiceNode } from './appServiceNodes';
import { AzureAccountWrapper } from './azureAccountWrapper';
import { WebAppCreator } from './webAppCreator';

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "Azure App Service Tools" is now active.');

    const outputChannel = vscode.window.createOutputChannel("Azure App Service");
    context.subscriptions.push(outputChannel);

    const azureAccount = new AzureAccountWrapper(context);
    const appServiceDataProvider = new AppServiceDataProvider(azureAccount);

    context.subscriptions.push(vscode.window.registerTreeDataProvider('azureAppService', appServiceDataProvider));
    context.subscriptions.push(vscode.commands.registerCommand('appService.Refresh', () => appServiceDataProvider.refresh()));
    context.subscriptions.push(vscode.commands.registerCommand('appService.Browse', (node: AppServiceNode) => {
        if (node) {
            node.browse();
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('appService.OpenInPortal', (node: AppServiceNode) => {
        if (node) {
            node.openInPortal(azureAccount);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('appService.Start', (node: AppServiceNode) => {
        if (node) {
            node.start(azureAccount).then(() => outputChannel.appendLine(`Starting App "${node.site.name}"...`));
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('appService.Stop', (node: AppServiceNode) => {
        if (node) {
            node.stop(azureAccount).then(() => outputChannel.appendLine(`Stopping App "${node.site.name}"...`));
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('appService.Restart', (node: AppServiceNode) => {
        if (node) {
            node.restart(azureAccount).then(() => outputChannel.appendLine(`Restarting App "${node.site.name}"...`));
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('appService.CreateWebApp', () => {
        const wizard = new WebAppCreator(azureAccount);
        wizard.start();
    }));
}

export function deactivate() {
}

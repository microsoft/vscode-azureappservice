/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as util from "./util";
import { AppServiceDataProvider } from './appServiceExplorer';
import { AppServiceNode } from './appServiceNodes';
import { AzureAccountWrapper } from './azureAccountWrapper';
import { WebAppCreator } from './webAppCreator';
import { WebAppZipPublisher } from './webAppZipPublisher'

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "Azure App Service Tools" is now active.');

    const outputChannel = util.getOutputChannel();
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
            outputChannel.appendLine(`Starting App "${node.site.name}"...`);
            node.start(azureAccount).then(() => outputChannel.appendLine(`App "${node.site.name}" has been started.`), err => outputChannel.appendLine(err));
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('appService.Stop', (node: AppServiceNode) => {
        if (node) {
            outputChannel.appendLine(`Stopping App "${node.site.name}"...`);
            node.stop(azureAccount).then(() => outputChannel.appendLine(`App "${node.site.name}" has been stopped.`), err => outputChannel.appendLine(err));
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('appService.Restart', (node: AppServiceNode) => {
        if (node) {
            outputChannel.appendLine(`Restarting App "${node.site.name}"...`);
            node.restart(azureAccount).then(() => outputChannel.appendLine(`App "${node.site.name}" has been restarted.`), err => outputChannel.appendLine(err));
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('appService.CreateWebApp', async () => {
        const wizard = new WebAppCreator(outputChannel, azureAccount);
        const result = await wizard.run();
        
        if (result.status === 'Completed') {
            vscode.commands.executeCommand('appService.Refresh');
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('appService.DeployZipPackage', async (context: any) => {
        if (context instanceof AppServiceNode) {
            const wizard = new WebAppZipPublisher(outputChannel, azureAccount, context.subscription, context.site);
            await wizard.run();
        } else if (context instanceof vscode.Uri) {
            const wizard = new WebAppZipPublisher(outputChannel, azureAccount, null, null, context.fsPath, null);
            await wizard.run();
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('appService.ZipAndDeploy', async (context: any) => {
        if (context instanceof vscode.Uri) {
            const folderPath = context.fsPath;
            const wizard = new WebAppZipPublisher(outputChannel, azureAccount, null, null, null, folderPath);
            await wizard.run();
        }
    }));
}

export function deactivate() {
}

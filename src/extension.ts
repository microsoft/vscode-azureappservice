/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as util from "./util";
import { AppServiceDataProvider } from './appServiceExplorer';
import { NodeBase } from './nodes/nodeBase';
import { AppServiceNode } from './nodes/appServiceNodes';
import { DeploymentSlotsNode } from './nodes/deploymentSlotsNodes';
import { DeploymentSlotNode } from './nodes/deploymentSlotNodes';
import { AzureAccountWrapper } from './azureAccountWrapper';
import { WebAppCreator } from './webAppCreator';
import { WebAppZipPublisher } from './webAppZipPublisher';
import { Reporter } from './telemetry/reporter';
import { DeploymentSlotSwapper } from './deploymentSlotActions';


export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "Azure App Service Tools" is now active.');

    context.subscriptions.push(new Reporter(context));

    const outputChannel = util.getOutputChannel();
    context.subscriptions.push(outputChannel);

    const azureAccount = new AzureAccountWrapper(context);
    const appServiceDataProvider = new AppServiceDataProvider(azureAccount);

    context.subscriptions.push(vscode.window.registerTreeDataProvider('azureAppService', appServiceDataProvider));

    initCommand(context, 'appService.Refresh', () => appServiceDataProvider.refresh());
    initCommand(context, 'appService.Browse', (node: AppServiceNode) => {
        if (node) {
            node.browse();
        }
    });
    initCommand(context, 'appService.OpenInPortal', (node: AppServiceNode) => {
        if (node) {
            node.openInPortal(azureAccount);
        }
    });
    initAsyncCommand(context,'appService.Start', async (node: AppServiceNode) => {
        if (node) {
            outputChannel.appendLine(`Starting App "${node.site.name}"...`);
            await node.start(azureAccount).then(() => outputChannel.appendLine(`App "${node.site.name}" has been started.`), err => outputChannel.appendLine(err));
        }
    });
    initAsyncCommand(context, 'appService.Stop', async (node: AppServiceNode) => {
        if (node) {
            outputChannel.appendLine(`Stopping App "${node.site.name}"...`);
            await node.stop(azureAccount).then(() => outputChannel.appendLine(`App "${node.site.name}" has been stopped.`), err => outputChannel.appendLine(err));
        }
    });
    initAsyncCommand(context, 'appService.Restart', async (node: AppServiceNode) => {
        if (node) {
            outputChannel.appendLine(`Restarting App "${node.site.name}"...`);
            await node.restart(azureAccount).then(() => outputChannel.appendLine(`App "${node.site.name}" has been restarted.`), err => outputChannel.appendLine(err));
        }
    });
    initAsyncCommand(context, 'appService.CreateWebApp', async () => {
        const wizard = new WebAppCreator(outputChannel, azureAccount);
        const result = await wizard.run();
        
        if (result.status === 'Completed') {
            vscode.commands.executeCommand('appService.Refresh');
        }
    });
    initAsyncCommand(context,'appService.DeployZipPackage', async (context: any) => {
        if (context instanceof AppServiceNode) {
            const wizard = new WebAppZipPublisher(outputChannel, azureAccount, context.subscription, context.site);
            await wizard.run();
        } else if (context instanceof vscode.Uri) {
            const wizard = new WebAppZipPublisher(outputChannel, azureAccount, null, null, context.fsPath, null);
            await wizard.run();
        }
    });
    initAsyncCommand(context, 'appService.ZipAndDeploy', async (context: any) => {
        if (context instanceof vscode.Uri) {
            const folderPath = context.fsPath;
            const wizard = new WebAppZipPublisher(outputChannel, azureAccount, null, null, null, folderPath);
            await wizard.run();
        }
    });
    initCommand(context, 'deploymentSlot.Browse', (node: DeploymentSlotNode) => {
        if (node) {
            node.browse();
        }
    });
    initCommand(context, 'deploymentSlot.OpenInPortal', (node: DeploymentSlotNode) => {
        if (node) {
            node.openInPortal(azureAccount);
        }
    });
    initAsyncCommand(context, 'deploymentSlot.SwapSlots', async (node: DeploymentSlotNode) => {
        if (node) {
            await node.swapDeploymentSlots(outputChannel, azureAccount);
        }
    });
}

export function deactivate() {
}

function initCommand(context: vscode.ExtensionContext, commandId: string, callback: (...args: any[]) => any) {
    initAsyncCommand(context, commandId, (...args: any[]) => Promise.resolve(callback(...args)));
}

function initAsyncCommand(context: vscode.ExtensionContext, commandId: string, callback: (...args: any[]) => Promise<any>) {
    context.subscriptions.push(vscode.commands.registerCommand(commandId, async (...args: any[]) => {
        const start = Date.now();
        let result = 'Succeeded';
        let errorData: string = '';

        try {
            await callback(...args);
        } catch (err) {
            result = 'Failed';
            errorData = util.errToString(err);
            throw err;
        } finally {
            const end = Date.now();
            util.sendTelemetry(commandId, { result: result, error: errorData }, { duration: (end - start) / 1000 });
        }
    }));
}

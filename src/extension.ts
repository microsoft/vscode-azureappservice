/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as util from "./util";
import { AppServiceDataProvider } from './explorer/appServiceExplorer';
import { NodeBase } from './explorer/nodeBase';
import { SiteNodeBase } from './explorer/siteNodeBase';
import { AppServiceNode } from './explorer/appServiceNode';
import { AppSettingsNode, AppSettingNode } from './explorer/appSettingsNodes';
import { DeploymentSlotsNode } from './explorer/deploymentSlotsNode';
import { DeploymentSlotNode } from './explorer/deploymentSlotNode';
import { SubscriptionNode } from './explorer/subscriptionNode';
import { WebJobsNode } from './explorer/webJobsNode';
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

    initCommand(context, 'appService.Refresh', (node?: NodeBase) => appServiceDataProvider.refresh(node));
    initCommand(context, 'appService.Browse', (node: SiteNodeBase) => {
        if (node) {
            node.browse();
        }
    });
    initCommand(context, 'appService.OpenInPortal', (node: NodeBase) => {
        if (node && node.openInPortal) {
            node.openInPortal();
        }
    });
    initAsyncCommand(context, 'appService.Start', async (node: AppServiceNode) => {
        if (node) {
            outputChannel.appendLine(`Starting App "${node.site.name}"...`);
            try {
                await node.start();
                outputChannel.appendLine(`App "${node.site.name}" has been started.`);
            } catch (err) {
                outputChannel.appendLine(err);
                throw err;
            }
        }
    });
    initAsyncCommand(context, 'appService.Stop', async (node: AppServiceNode) => {
        if (node) {
            outputChannel.appendLine(`Stopping App "${node.site.name}"...`);
            try {
                await node.stop();
                outputChannel.appendLine(`App "${node.site.name}" has been stopped.`);
            } catch (err) {
                outputChannel.appendLine(err);
                throw err;
            }
        }
    });
    initAsyncCommand(context, 'appService.Restart', async (node: AppServiceNode) => {
        if (node) {
            outputChannel.appendLine(`Restarting App "${node.site.name}"...`);
            try {
                await node.restart();
                outputChannel.appendLine(`App "${node.site.name}" has been restarted.`);
            } catch (err) {
                outputChannel.appendLine(err);
                throw err;
            }
        }
    });
    initAsyncCommand(context, 'appService.CreateWebApp', async (node?: SubscriptionNode) => {
        let subscription;
        if (node) {
            subscription = node.subscription;
        }

        const wizard = new WebAppCreator(outputChannel, azureAccount, subscription);
        const result = await wizard.run();

        if (result.status === 'Completed') {
            vscode.commands.executeCommand('appService.Refresh', node);
        }
    });
    initAsyncCommand(context, 'appService.DeployZipPackage', async (context: any) => {
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
    initAsyncCommand(context, 'appService.LocalGitDeploy', async (node: AppServiceNode) => {
        if (node) {
            outputChannel.appendLine(`Deploying Local Git repository to "${node.site.name}"...`);
            const deployment = await node.localGitDeploy(azureAccount);
            if (deployment) {
                outputChannel.appendLine('Deployment completed.');
            } else {
                outputChannel.appendLine('Deployment failed.');
            }
        }
    });
    initAsyncCommand(context, 'deploymentSlot.SwapSlots', async (node: DeploymentSlotNode) => {
        if (node) {
            await node.swapDeploymentSlots(outputChannel);
        }
    });
    initAsyncCommand(context, 'appSettings.Add', async (node: AppSettingsNode) => {
        if (node) {
            await node.addSettingItem();
        }
    });
    initAsyncCommand(context, 'appSettings.Edit', async (node: AppSettingNode) => {
        if (node) {
            await node.edit();
        }
    });
    initAsyncCommand(context, 'appSettings.Delete', async (node: AppSettingNode) => {
        if (node) {
            await node.delete();
        }
    });
    initAsyncCommand(context, 'diagnostics.OpenLogStream', async (node: SiteNodeBase) => {
        if (node) {
            await node.connectToLogStream(context);
        }
    });
    initCommand(context, 'diagnostics.StopLogStream', (node: SiteNodeBase) => {
        if (node) {
            node.stopLogStream();
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

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WebSiteModels from 'azure-arm-website/lib/models';
import { SiteConfigResource } from 'azure-arm-website/lib/models';
import { randomBytes } from 'crypto';
import { pathExists } from 'fs-extra';
import * as path from 'path';
import { join } from 'path';
import * as vscode from 'vscode';
import { MessageItem } from 'vscode';
import * as appservice from 'vscode-azureappservice';
import { AzureTreeItem, DialogResponses, IActionContext, parseError } from 'vscode-azureextensionui';
import * as constants from '../constants';
import { SiteTreeItem } from '../explorer/SiteTreeItem';
import { WebAppTreeItem } from '../explorer/WebAppTreeItem';
import { ext } from '../extensionVariables';
import * as javaUtil from '../utils/javaUtils';
import { isPathEqual, isSubpath } from '../utils/pathUtils';
import * as workspaceUtil from '../utils/workspace';
import { cancelWebsiteValidation, validateWebSite } from '../validateWebSite';
import { startStreamingLogs } from './startStreamingLogs';

// tslint:disable-next-line:max-func-body-length cyclomatic-complexity
export async function deploy(context: IActionContext, confirmDeployment: boolean, target?: vscode.Uri | SiteTreeItem | undefined): Promise<void> {

    let node: SiteTreeItem | undefined;
    const newNodes: SiteTreeItem[] = [];
    let fsPath: string | undefined;
    let currentWorkspace: vscode.WorkspaceFolder | undefined;
    let defaultWebAppToDeploy: string | undefined;
    let workspaceConfig: vscode.WorkspaceConfiguration;
    context.properties.deployedWithConfigs = 'false';

    if (target instanceof vscode.Uri) {
        fsPath = target.fsPath;
        context.properties.deploymentEntryPoint = 'fileExplorerContextMenu';
    } else {
        context.properties.deploymentEntryPoint = target ? 'webAppContextMenu' : 'deployButton';
        node = target;
    }

    // only use the defaultWebAppToDeploy is there is only one workspace opened
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length === 1) {
        currentWorkspace = vscode.workspace.workspaceFolders[0];
        workspaceConfig = vscode.workspace.getConfiguration(constants.extensionPrefix, currentWorkspace.uri);
        defaultWebAppToDeploy = workspaceConfig.get(constants.configurationSettings.defaultWebAppToDeploy);
        if (defaultWebAppToDeploy && defaultWebAppToDeploy !== constants.none) {
            const defaultSubpath: string | undefined = workspaceConfig.get(constants.configurationSettings.deploySubpath);
            const defaultDeployPath: string = defaultSubpath ? join(currentWorkspace.uri.fsPath, defaultSubpath) : currentWorkspace.uri.fsPath;
            const defaultPathExists: boolean = await pathExists(defaultDeployPath);
            const defaultNode: AzureTreeItem | undefined = await ext.tree.findTreeItem(defaultWebAppToDeploy); // resolves to undefined if app can't be found
            if (defaultPathExists && (!fsPath || isPathEqual(fsPath, defaultDeployPath)) &&
                defaultNode && (!node || node.fullId === defaultNode.fullId)) {
                fsPath = defaultDeployPath;
                node = <SiteTreeItem>defaultNode;
                context.properties.deployedWithConfigs = 'true';
            } else {
                // if defaultPath or defaultNode cannot be found or there was a mismatch, delete old settings and prompt to save next deployment
                workspaceConfig.update(constants.configurationSettings.defaultWebAppToDeploy, undefined);
                defaultWebAppToDeploy = undefined;
            }
        }
    }

    if (!node) {
        const onTreeItemCreatedFromQuickPickDisposable: vscode.Disposable = ext.tree.onTreeItemCreate((newNode: SiteTreeItem) => {
            // event is fired from azure-extensionui if node was created during deployment
            newNodes.push(newNode);
        });
        try {
            node = <SiteTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue);
        } catch (err2) {
            if (parseError(err2).isUserCancelledError) {
                context.properties.cancelStep = `showTreeItemPicker:${WebAppTreeItem.contextValue}`;
            }
            throw err2;
        } finally {
            onTreeItemCreatedFromQuickPickDisposable.dispose();
        }
    }

    if (newNodes.length > 0) {
        for (const newApp of newNodes) {
            if (newApp.fullId === node.fullId) {
                // if the node selected for deployment is the same newly created nodes, stifle the confirmDeployment dialog
                confirmDeployment = false;
                newApp.root.client.getSiteConfig().then(
                    (createdAppConfig: SiteConfigResource) => {
                        context.properties.linuxFxVersion = createdAppConfig.linuxFxVersion ? createdAppConfig.linuxFxVersion : 'undefined';
                        context.properties.createdFromDeploy = 'true';
                    },
                    () => {
                        // ignore
                    });
            }
        }
    }

    const correlationId = getRandomHexString(10);
    context.properties.correlationId = correlationId;
    const siteConfig: WebSiteModels.SiteConfigResource = await node.root.client.getSiteConfig();

    if (!fsPath) {
        if (javaUtil.isJavaRuntime(siteConfig.linuxFxVersion)) {
            fsPath = await javaUtil.getJavaRuntimeTargetFile(siteConfig.linuxFxVersion, context.properties);
        } else {
            fsPath = await workspaceUtil.showWorkspaceFoldersQuickPick("Select the folder to deploy", context.properties, constants.configurationSettings.deploySubpath);
        }
    }
    workspaceConfig = vscode.workspace.getConfiguration(constants.extensionPrefix, vscode.Uri.file(fsPath));
    if (currentWorkspace && (isPathEqual(currentWorkspace.uri.fsPath, fsPath) || isSubpath(currentWorkspace.uri.fsPath, fsPath))) {
        // currentWorkspace is only set if there is one active workspace
        // only check enableScmDoBuildDuringDeploy if currentWorkspace matches the workspace being deployed as a user can "Browse" to a different project
        if (workspaceConfig.get(constants.configurationSettings.showBuildDuringDeployPrompt)) {
            //check if node is being zipdeployed and that there is no .deployment file
            if (siteConfig.linuxFxVersion && siteConfig.scmType === 'None' && !(await pathExists(path.join(fsPath, constants.deploymentFileName)))) {
                if (siteConfig.linuxFxVersion.startsWith(constants.runtimes.node)) {
                    // if it is node or python, prompt the user (as we can break them)
                    await node.promptScmDoBuildDeploy(fsPath, constants.runtimes.node, context.properties);
                } else if (siteConfig.linuxFxVersion.startsWith(constants.runtimes.python)) {
                    await node.promptScmDoBuildDeploy(fsPath, constants.runtimes.python, context.properties);
                }

            }
        }
    }

    if (confirmDeployment && siteConfig.scmType !== constants.ScmType.LocalGit && siteConfig !== constants.ScmType.GitHub) {
        const warning: string = `Are you sure you want to deploy to "${node.root.client.fullName}"? This will overwrite any previous deployment and cannot be undone.`;
        context.properties.cancelStep = 'confirmDestructiveDeployment';
        const items: vscode.MessageItem[] = [{ title: 'Deploy' }];
        const resetDefault: vscode.MessageItem = { title: 'Reset default' };
        if (defaultWebAppToDeploy) {
            items.push(resetDefault);
        }
        items.push(DialogResponses.cancel);

        // a temporary workaround for this issue: https://github.com/Microsoft/vscode-azureappservice/issues/844
        await new Promise((resolve) => setTimeout(resolve, 500));
        const result: vscode.MessageItem = await ext.ui.showWarningMessage(warning, { modal: true }, ...items);
        if (result === resetDefault) {
            // tslint:disable-next-line:no-non-null-assertion
            const localRootPath = currentWorkspace!.uri.fsPath;
            const settingsPath = path.join(localRootPath, '.vscode', 'settings.json');
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(settingsPath));
            vscode.window.showTextDocument(doc);
            await workspaceConfig.update(constants.configurationSettings.defaultWebAppToDeploy, '');
            // If resetDefault button was clicked we ask what and where to deploy again
            await vscode.commands.executeCommand('appService.Deploy');
            return;
        }
        context.properties.cancelStep = '';
    }

    if (!defaultWebAppToDeploy && currentWorkspace && (isPathEqual(currentWorkspace.uri.fsPath, fsPath) || isSubpath(currentWorkspace.uri.fsPath, fsPath))) {
        // tslint:disable-next-line:no-floating-promises
        node.promptToSaveDeployDefaults(currentWorkspace.uri.fsPath, fsPath, context.properties);
    }

    const preDeployResult: appservice.IPreDeployTaskResult = await appservice.runPreDeployTask(context, fsPath, siteConfig.scmType, constants.extensionPrefix);
    if (preDeployResult.failedToFindTask) {
        throw new Error(`Failed to find pre-deploy task "${preDeployResult.taskName}". Modify your tasks or the setting "${constants.extensionPrefix}.preDeployTask".`);
    }

    cancelWebsiteValidation(node);
    await node.runWithTemporaryDescription("Deploying...", async () => {
        // tslint:disable-next-line:no-non-null-assertion
        await appservice.deploy(node!.root.client, <string>fsPath, constants.extensionPrefix, context.properties);
    });

    const deployComplete: string = `Deployment to "${node.root.client.fullName}" completed.`;
    ext.outputChannel.appendLine(deployComplete);
    const viewOutput: MessageItem = { title: 'View Output' };
    const browseWebsite: MessageItem = { title: 'Browse Website' };
    const streamLogs: MessageItem = { title: 'Stream Logs' };

    // Don't wait
    vscode.window.showInformationMessage(deployComplete, browseWebsite, streamLogs, viewOutput).then(async (result: MessageItem | undefined) => {
        if (result === viewOutput) {
            ext.outputChannel.show();
        } else if (result === browseWebsite) {
            // tslint:disable-next-line:no-non-null-assertion
            node!.browse();
        } else if (result === streamLogs) {
            await startStreamingLogs(node);
        }
    });

    // Don't wait
    validateWebSite(correlationId, node).then(
        () => {
            // ignore
        },
        () => {
            // ignore
        });
}

function getRandomHexString(length: number): string {
    const buffer: Buffer = randomBytes(Math.ceil(length / 2));
    return buffer.toString('hex').slice(0, length);
}

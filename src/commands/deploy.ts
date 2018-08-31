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
import * as appservice from 'vscode-azureappservice';
import { DialogResponses, IActionContext, IAzureNode, IAzureTreeItem, parseError } from 'vscode-azureextensionui';
import * as constants from '../constants';
import { SiteTreeItem } from '../explorer/SiteTreeItem';
import { WebAppTreeItem } from '../explorer/WebAppTreeItem';
import { ext } from '../extensionVariables';
import * as util from '../util';
import * as javaUtil from '../utils/javaUtils';
import { isPathEqual, isSubpath } from '../utils/pathUtils';
import { cancelWebsiteValidation, validateWebSite } from '../validateWebSite';

// tslint:disable-next-line:max-func-body-length cyclomatic-complexity
export async function deploy(context: IActionContext, confirmDeployment: boolean, target?: vscode.Uri | IAzureNode<SiteTreeItem> | undefined): Promise<void> {

    let node: IAzureNode<SiteTreeItem> | undefined;
    const newNodes: IAzureNode<SiteTreeItem>[] = [];
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
            const defaultNode: IAzureNode<IAzureTreeItem> | undefined = await ext.tree.findNode(defaultWebAppToDeploy); // resolves to undefined if app can't be found
            if (defaultPathExists && (!fsPath || isPathEqual(fsPath, defaultDeployPath)) &&
                defaultNode && (!node || node.id === defaultNode.id)) {
                fsPath = defaultDeployPath;
                node = <IAzureNode<SiteTreeItem>>defaultNode;
                context.properties.deployedWithConfigs = 'true';
            } else {
                // if defaultPath or defaultNode cannot be found or there was a mismatch, delete old settings and prompt to save next deployment
                workspaceConfig.update(constants.configurationSettings.defaultWebAppToDeploy, undefined);
                defaultWebAppToDeploy = undefined;
            }
        }
    }

    if (!node) {
        const onNodeCreatedFromQuickPickDisposable: vscode.Disposable = ext.tree.onNodeCreate((newNode: IAzureNode<SiteTreeItem>) => {
            // event is fired from azure-extensionui if node was created during deployment
            newNodes.push(newNode);
        });
        try {
            node = <IAzureNode<SiteTreeItem>>await ext.tree.showNodePicker(WebAppTreeItem.contextValue);
        } catch (err2) {
            if (parseError(err2).isUserCancelledError) {
                context.properties.cancelStep = `showNodePicker:${WebAppTreeItem.contextValue}`;
            }
            throw err2;
        } finally {
            onNodeCreatedFromQuickPickDisposable.dispose();
        }
    }

    if (newNodes.length > 0) {
        for (const newApp of newNodes) {
            if (newApp.id === node.id) {
                // if the node selected for deployment is the same newly created nodes, stifle the confirmDeployment dialog
                confirmDeployment = false;
                newApp.treeItem.client.getSiteConfig().then(
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
    const siteConfig: WebSiteModels.SiteConfigResource = await node.treeItem.client.getSiteConfig();

    if (!fsPath) {
        if (javaUtil.isJavaRuntime(siteConfig.linuxFxVersion)) {
            fsPath = await javaUtil.getJavaRuntimeTargetFile(siteConfig.linuxFxVersion, context.properties);
        } else {
            fsPath = await util.showWorkspaceFoldersQuickPick("Select the folder to deploy", context.properties, constants.configurationSettings.deploySubpath);
        }
    }
    workspaceConfig = vscode.workspace.getConfiguration(constants.extensionPrefix, vscode.Uri.file(fsPath));
    if (workspaceConfig.get(constants.configurationSettings.showBuildDuringDeployPrompt)) {
        if (siteConfig.linuxFxVersion && siteConfig.linuxFxVersion.startsWith(constants.runtimes.node) && siteConfig.scmType === 'None' && !(await pathExists(path.join(fsPath, constants.deploymentFileName)))) {
            // check if web app has node runtime, is being zipdeployed, and if there is no .deployment file
            // tslint:disable-next-line:no-unsafe-any
            await node.treeItem.enableScmDoBuildDuringDeploy(fsPath, constants.runtimes[siteConfig.linuxFxVersion.substring(0, siteConfig.linuxFxVersion.indexOf('|'))], context.properties);
        }
    }

    if (confirmDeployment && siteConfig.scmType !== constants.ScmType.LocalGit && siteConfig !== constants.ScmType.GitHub) {
        const warning: string = `Are you sure you want to deploy to "${node.treeItem.client.fullName}"? This will overwrite any previous deployment and cannot be undone.`;
        context.properties.cancelStep = 'confirmDestructiveDeployment';
        const items: vscode.MessageItem[] = [{ title: 'Deploy' }, DialogResponses.cancel];
        if (defaultWebAppToDeploy) {
            items.push({ title: 'Reset default' });
        }
        const result: vscode.MessageItem = await ext.ui.showWarningMessage(warning, { modal: true }, ...items);
        if (result.title === 'Reset default') {
            // tslint:disable-next-line:no-non-null-assertion
            const localRootPath = currentWorkspace!.uri.fsPath;
            const settingsPath = path.join(localRootPath, '.vscode', 'settings.json');
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(settingsPath));
            vscode.window.showTextDocument(doc);
            const workspaceConfiguration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(constants.extensionPrefix, vscode.Uri.file(fsPath));
            await workspaceConfiguration.update(constants.configurationSettings.defaultWebAppToDeploy, '');
            await vscode.commands.executeCommand('appService.Deploy');
            return;
        }
        context.properties.cancelStep = '';
    }

    if (!defaultWebAppToDeploy && currentWorkspace && (isPathEqual(currentWorkspace.uri.fsPath, fsPath) || isSubpath(currentWorkspace.uri.fsPath, fsPath))) {
        // tslint:disable-next-line:no-floating-promises
        node.treeItem.promptToSaveDeployDefaults(node, currentWorkspace.uri.fsPath, fsPath, context.properties);
    }
    cancelWebsiteValidation(node.treeItem);
    await node.runWithTemporaryDescription("Deploying...", async () => {
        // tslint:disable-next-line:no-non-null-assertion
        await appservice.deploy(node!.treeItem.client, <string>fsPath, constants.extensionPrefix, context.properties);
    });
    // Don't wait
    validateWebSite(correlationId, node.treeItem).then(
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

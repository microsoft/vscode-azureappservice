/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WebSiteModels from 'azure-arm-website/lib/models';
import { SiteConfigResource } from 'azure-arm-website/lib/models';
import { pathExists } from 'fs-extra';
import * as path from 'path';
import { join } from 'path';
import { commands, Disposable, MessageItem, Uri, window, workspace, WorkspaceConfiguration, WorkspaceFolder } from 'vscode';
import * as appservice from 'vscode-azureappservice';
import { AzureTreeItem, DialogResponses, IActionContext, parseError } from 'vscode-azureextensionui';
import * as constants from '../constants';
import { SiteTreeItem } from '../explorer/SiteTreeItem';
import { WebAppTreeItem } from '../explorer/WebAppTreeItem';
import { ext } from '../extensionVariables';
import { delay } from '../utils/delay';
import { javaUtils } from '../utils/javaUtils';
import { nonNullValue } from '../utils/nonNull';
import { isPathEqual, isSubpath } from '../utils/pathUtils';
import { getRandomHexString } from "../utils/randomUtils";
import * as workspaceUtil from '../utils/workspace';
import { cancelWebsiteValidation, validateWebSite } from '../validateWebSite';
import { startStreamingLogs } from './startStreamingLogs';

// tslint:disable-next-line:max-func-body-length cyclomatic-complexity
export async function deploy(context: IActionContext, confirmDeployment: boolean, target?: Uri | SiteTreeItem | undefined): Promise<void> {

    let node: SiteTreeItem | undefined;
    const newNodes: SiteTreeItem[] = [];
    let fsPath: string | undefined;
    let currentWorkspace: WorkspaceFolder | undefined;
    let defaultWebAppToDeploy: string | undefined;
    let workspaceConfig: WorkspaceConfiguration;
    context.telemetry.properties.deployedWithConfigs = 'false';

    if (target instanceof Uri) {
        fsPath = target.fsPath;
        context.telemetry.properties.deploymentEntryPoint = 'fileExplorerContextMenu';
    } else {
        context.telemetry.properties.deploymentEntryPoint = target ? 'webAppContextMenu' : 'deployButton';
        node = target;
    }

    // only use the defaultWebAppToDeploy is there is only one workspace opened
    if (workspace.workspaceFolders && workspace.workspaceFolders.length === 1) {
        currentWorkspace = workspace.workspaceFolders[0];
        workspaceConfig = workspace.getConfiguration(constants.extensionPrefix, currentWorkspace.uri);
        defaultWebAppToDeploy = workspaceConfig.get(constants.configurationSettings.defaultWebAppToDeploy);
        if (defaultWebAppToDeploy && defaultWebAppToDeploy !== constants.none) {
            const defaultSubpath: string | undefined = workspaceConfig.get(constants.configurationSettings.deploySubpath);
            const defaultDeployPath: string = defaultSubpath ? join(currentWorkspace.uri.fsPath, defaultSubpath) : currentWorkspace.uri.fsPath;
            const defaultPathExists: boolean = await pathExists(defaultDeployPath);
            const defaultNode: AzureTreeItem | undefined = await ext.tree.findTreeItem(defaultWebAppToDeploy, context); // resolves to undefined if app can't be found
            if (defaultPathExists && (!fsPath || isPathEqual(fsPath, defaultDeployPath)) &&
                defaultNode && (!node || node.fullId === defaultNode.fullId)) {
                fsPath = defaultDeployPath;
                node = <SiteTreeItem>defaultNode;
                context.telemetry.properties.deployedWithConfigs = 'true';
            } else {
                // if defaultPath or defaultNode cannot be found or there was a mismatch, delete old settings and prompt to save next deployment
                workspaceConfig.update(constants.configurationSettings.defaultWebAppToDeploy, undefined);
                defaultWebAppToDeploy = undefined;
            }
        }
    }

    if (!node) {
        const onTreeItemCreatedFromQuickPickDisposable: Disposable = ext.tree.onTreeItemCreate((newNode: SiteTreeItem) => {
            // event is fired from azure-extensionui if node was created during deployment
            newNodes.push(newNode);
        });
        try {
            node = <SiteTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue, context);
        } catch (err2) {
            if (parseError(err2).isUserCancelledError) {
                context.telemetry.properties.cancelStep = `showTreeItemPicker:${WebAppTreeItem.contextValue}`;
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
                        context.telemetry.properties.linuxFxVersion = createdAppConfig.linuxFxVersion ? createdAppConfig.linuxFxVersion : 'undefined';
                        context.telemetry.properties.createdFromDeploy = 'true';
                    },
                    () => {
                        // ignore
                    });
            }
        }
    }

    const correlationId = getRandomHexString();
    context.telemetry.properties.correlationId = correlationId;
    const siteConfig: WebSiteModels.SiteConfigResource = await node.root.client.getSiteConfig();

    if (!fsPath) {
        if (javaUtils.isJavaRuntime(siteConfig.linuxFxVersion)) {
            const fileExtension: string = javaUtils.getArtifactTypeByJavaRuntime(siteConfig.linuxFxVersion);
            fsPath = await javaUtils.showQuickPickByFileExtension(context, `Select the ${fileExtension} file to deploy...`, fileExtension);
            await javaUtils.configureJavaSEAppSettings(node);
        } else {
            fsPath = await workspaceUtil.showWorkspaceFoldersQuickPick("Select the folder to deploy", context, constants.configurationSettings.deploySubpath);
        }
    }

    workspaceConfig = workspace.getConfiguration(constants.extensionPrefix, Uri.file(fsPath));
    if (currentWorkspace && (isPathEqual(currentWorkspace.uri.fsPath, fsPath) || isSubpath(currentWorkspace.uri.fsPath, fsPath))) {
        // currentWorkspace is only set if there is one active workspace
        // only check enableScmDoBuildDuringDeploy if currentWorkspace matches the workspace being deployed as a user can "Browse" to a different project
        if (workspaceConfig.get(constants.configurationSettings.showBuildDuringDeployPrompt)) {
            //check if node is being zipdeployed and that there is no .deployment file
            if (siteConfig.linuxFxVersion && siteConfig.scmType === 'None' && !(await pathExists(path.join(fsPath, constants.deploymentFileName)))) {
                const linuxFxVersion: string = siteConfig.linuxFxVersion.toLowerCase();
                if (linuxFxVersion.startsWith(appservice.LinuxRuntimes.node)) {
                    // if it is node or python, prompt the user (as we can break them)
                    await node.promptScmDoBuildDeploy(fsPath, appservice.LinuxRuntimes.node, context);
                } else if (linuxFxVersion.startsWith(appservice.LinuxRuntimes.python)) {
                    await node.promptScmDoBuildDeploy(fsPath, appservice.LinuxRuntimes.python, context);
                }

            }
        }
    }

    if (confirmDeployment && siteConfig.scmType !== constants.ScmType.LocalGit && siteConfig !== constants.ScmType.GitHub) {
        const warning: string = `Are you sure you want to deploy to "${node.root.client.fullName}"? This will overwrite any previous deployment and cannot be undone.`;
        context.telemetry.properties.cancelStep = 'confirmDestructiveDeployment';
        const items: MessageItem[] = [{ title: 'Deploy' }];
        const resetDefault: MessageItem = { title: 'Reset default' };
        if (defaultWebAppToDeploy) {
            items.push(resetDefault);
        }
        items.push(DialogResponses.cancel);

        // a temporary workaround for this issue: https://github.com/Microsoft/vscode-azureappservice/issues/844
        await delay(500);
        const result: MessageItem = await ext.ui.showWarningMessage(warning, { modal: true }, ...items);
        if (result === resetDefault) {
            const localRootPath = nonNullValue(currentWorkspace).uri.fsPath;
            const settingsPath = path.join(localRootPath, '.vscode', 'settings.json');
            const doc = await workspace.openTextDocument(Uri.file(settingsPath));
            window.showTextDocument(doc);
            await workspaceConfig.update(constants.configurationSettings.defaultWebAppToDeploy, '');
            // If resetDefault button was clicked we ask what and where to deploy again
            await commands.executeCommand('appService.Deploy');
            return;
        }
        context.telemetry.properties.cancelStep = '';
    }

    if (!defaultWebAppToDeploy && currentWorkspace && (isPathEqual(currentWorkspace.uri.fsPath, fsPath) || isSubpath(currentWorkspace.uri.fsPath, fsPath))) {
        // tslint:disable-next-line:no-floating-promises
        node.promptToSaveDeployDefaults(currentWorkspace.uri.fsPath, fsPath, context);
    }

    await appservice.runPreDeployTask(context, fsPath, siteConfig.scmType, constants.extensionPrefix);

    cancelWebsiteValidation(node);
    await node.runWithTemporaryDescription("Deploying...", async () => {
        await appservice.deploy(nonNullValue(node).root.client, <string>fsPath, context);
    });

    const deployComplete: string = `Deployment to "${node.root.client.fullName}" completed.`;
    ext.outputChannel.appendLine(deployComplete);
    const viewOutput: MessageItem = { title: 'View Output' };
    const browseWebsite: MessageItem = { title: 'Browse Website' };
    const streamLogs: MessageItem = { title: 'Stream Logs' };

    // Don't wait
    window.showInformationMessage(deployComplete, browseWebsite, streamLogs, viewOutput).then(async (result: MessageItem | undefined) => {
        if (result === viewOutput) {
            ext.outputChannel.show();
        } else if (result === browseWebsite) {
            await nonNullValue(node).browse();
        } else if (result === streamLogs) {
            await startStreamingLogs(context, node);
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

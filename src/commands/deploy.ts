/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WebSiteModels from 'azure-arm-website/lib/models';
import { SiteConfigResource } from 'azure-arm-website/lib/models';
import { pathExists } from 'fs-extra';
import * as path from 'path';
import { commands, ConfigurationTarget, Disposable, MessageItem, Uri, window, workspace, WorkspaceConfiguration, WorkspaceFolder } from 'vscode';
import * as appservice from 'vscode-azureappservice';
import { DialogResponses, IAzureQuickPickItem, parseError } from 'vscode-azureextensionui';
import * as constants from '../constants';
import { IDeployWizardContext } from '../explorer/setAppWizardContextDefault';
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
import { getDefaultWebAppToDeploy } from './getDefaultWebAppToDeploy';
import { startStreamingLogs } from './startStreamingLogs';

// tslint:disable-next-line:max-func-body-length cyclomatic-complexity
export async function deploy(context: IDeployWizardContext, confirmDeployment: boolean, target?: Uri | SiteTreeItem | undefined): Promise<void> {

    let node: SiteTreeItem | undefined;
    const newNodes: SiteTreeItem[] = [];
    let workspaceConfig: WorkspaceConfiguration;
    context.telemetry.properties.deployedWithConfigs = 'false';

    if (target instanceof Uri) {
        context.fsPath = target.fsPath;
        context.telemetry.properties.deploymentEntryPoint = 'fileExplorerContextMenu';
    } else {
        context.telemetry.properties.deploymentEntryPoint = target ? 'webAppContextMenu' : 'deployButton';
        node = target;
    }

    let siteConfig: WebSiteModels.SiteConfigResource | undefined;

    if (!context.fsPath) {
        // we can only get the siteConfig if the entry point was a treeItem
        siteConfig = node ? await node.root.client.getSiteConfig() : undefined;

        if (siteConfig && javaUtils.isJavaRuntime(siteConfig.linuxFxVersion)) {
            const fileExtension: string = javaUtils.getArtifactTypeByJavaRuntime(siteConfig.linuxFxVersion);
            context.fsPath = await workspaceUtil.showWorkspaceFolders(`Select the ${fileExtension} file to deploy...`, context, constants.configurationSettings.deploySubpath, fileExtension);
        } else {
            context.fsPath = await workspaceUtil.showWorkspaceFolders("Select the folder to deploy", context, constants.configurationSettings.deploySubpath);
        }
    }

    node = await getDefaultWebAppToDeploy(context);

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

    siteConfig = siteConfig ? siteConfig : await node.root.client.getSiteConfig();

    if (javaUtils.isJavaRuntime(siteConfig.linuxFxVersion)) {
        const javaArtifactFiles: Uri[] = await workspaceUtil.findFilesByFileExtension(context.fsPath, javaUtils.getArtifactTypeByJavaRuntime(siteConfig.linuxFxVersion));
        if (javaArtifactFiles.length > 0) {
            const javaArtifactQp: IAzureQuickPickItem<string>[] = workspaceUtil.mapFilesToQuickPickItems(javaArtifactFiles);
            // check if there is a jar/war file in the fsPath that was provided
            context.fsPath = <string>(await ext.ui.showQuickPick(javaArtifactQp, { placeHolder: `Select the ${javaUtils.getArtifactTypeByJavaRuntime(siteConfig.linuxFxVersion)} file to deploy...` })).data;
        }
        await javaUtils.configureJavaSEAppSettings(node);
    }

    workspaceConfig = workspace.getConfiguration(constants.extensionPrefix, Uri.file(context.fsPath));

    const currentWorkspace: WorkspaceFolder | undefined = workspaceUtil.getContainingWorkspace(context.fsPath);
    if (currentWorkspace && (isPathEqual(currentWorkspace.uri.fsPath, context.fsPath) || isSubpath(currentWorkspace.uri.fsPath, context.fsPath))) {
        // currentWorkspace is only set if there is one active workspace
        // only check enableScmDoBuildDuringDeploy if currentWorkspace matches the workspace being deployed as a user can "Browse" to a different project
        if (workspaceConfig.get(constants.configurationSettings.showBuildDuringDeployPrompt)) {
            //check if node is being zipdeployed and that there is no .deployment file
            if (siteConfig.linuxFxVersion && siteConfig.scmType === 'None' && !(await pathExists(path.join(context.fsPath, constants.deploymentFileName)))) {
                const linuxFxVersion: string = siteConfig.linuxFxVersion.toLowerCase();
                if (linuxFxVersion.startsWith(appservice.LinuxRuntimes.node)) {
                    // if it is node or python, prompt the user (as we can break them)
                    await node.promptScmDoBuildDeploy(context.fsPath, appservice.LinuxRuntimes.node, context);
                } else if (linuxFxVersion.startsWith(appservice.LinuxRuntimes.python)) {
                    await node.promptScmDoBuildDeploy(context.fsPath, appservice.LinuxRuntimes.python, context);
                }

            }
        }
    }

    if (confirmDeployment && siteConfig.scmType !== constants.ScmType.LocalGit && siteConfig !== constants.ScmType.GitHub) {
        const warning: string = `Are you sure you want to deploy to "${node.root.client.fullName}"? This will overwrite any previous deployment and cannot be undone.`;
        context.telemetry.properties.cancelStep = 'confirmDestructiveDeployment';
        const items: MessageItem[] = [constants.AppServiceDialogResponses.deploy];
        const resetDefault: MessageItem = { title: 'Reset default' };
        if (context.deployedWithConfigs) {
            items.push(resetDefault);
        }

        items.push(DialogResponses.cancel);

        // a temporary workaround for this issue: https://github.com/Microsoft/vscode-azureappservice/issues/844
        await delay(500);
        const result: MessageItem = await ext.ui.showWarningMessage(warning, { modal: true }, ...items);
        if (result === resetDefault) {
            if (context.configurationTarget === ConfigurationTarget.Global) {
                await commands.executeCommand('workbench.action.openGlobalSettings');
            } else {
                const localRootPath = nonNullValue(currentWorkspace).uri.fsPath;
                const settingsPath = path.join(localRootPath, '.vscode', 'settings.json');
                const doc = await workspace.openTextDocument(Uri.file(settingsPath));
                window.showTextDocument(doc);
            }

            await workspaceConfig.update(constants.configurationSettings.defaultWebAppToDeploy, '', context.configurationTarget);

            // If resetDefault button was clicked we ask what and where to deploy again
            await commands.executeCommand('appService.Deploy');
            return;
        }
        context.telemetry.properties.cancelStep = '';
    }

    if (!context.deployedWithConfigs && currentWorkspace && (isPathEqual(currentWorkspace.uri.fsPath, context.fsPath) || isSubpath(currentWorkspace.uri.fsPath, context.fsPath))) {
        // tslint:disable-next-line:no-floating-promises
        node.promptToSaveDeployDefaults(currentWorkspace.uri.fsPath, context.fsPath, context);
    }

    await appservice.runPreDeployTask(context, context.fsPath, siteConfig.scmType, constants.extensionPrefix);

    cancelWebsiteValidation(node);
    await node.runWithTemporaryDescription("Deploying...", async () => {
        await appservice.deploy(nonNullValue(node).root.client, <string>context.fsPath, context, constants.showOutputChannelCommandId);
    });

    const deployComplete: string = `Deployment to "${node.root.client.fullName}" completed.`;
    ext.outputChannel.appendLine(deployComplete);
    const browseWebsite: MessageItem = { title: 'Browse Website' };
    const streamLogs: MessageItem = { title: 'Stream Logs' };

    // Don't wait
    window.showInformationMessage(deployComplete, browseWebsite, streamLogs, constants.AppServiceDialogResponses.viewOutput).then(async (result: MessageItem | undefined) => {
        if (result === constants.AppServiceDialogResponses.viewOutput) {
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

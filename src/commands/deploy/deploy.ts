/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WebSiteModels from 'azure-arm-website/lib/models';
import { SiteConfigResource } from 'azure-arm-website/lib/models';
import { pathExists } from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import * as appservice from 'vscode-azureappservice';
import { DialogResponses, IActionContext, IAzureQuickPickItem, parseError } from 'vscode-azureextensionui';
import * as constants from '../../constants';
import { SiteTreeItem } from '../../explorer/SiteTreeItem';
import { WebAppTreeItem } from '../../explorer/WebAppTreeItem';
import { ext } from '../../extensionVariables';
import { delay } from '../../utils/delay';
import { javaUtils } from '../../utils/javaUtils';
import { nonNullValue } from '../../utils/nonNull';
import { getRandomHexString } from "../../utils/randomUtils";
import * as workspaceUtil from '../../utils/workspace';
import { cancelWebsiteValidation, validateWebSite } from '../../validateWebSite';
import { getWorkspaceSetting, updateWorkspaceSetting } from '../../vsCodeConfig/settings';
import { startStreamingLogs } from '../startStreamingLogs';
import { getDefaultWebAppToDeploy } from './getDefaultWebAppToDeploy';
import { IDeployWizardContext, WebAppSource } from './IDeployWizardContext';

// tslint:disable-next-line:max-func-body-length cyclomatic-complexity
export async function deploy(context: IActionContext, confirmDeployment: boolean, target?: vscode.Uri | SiteTreeItem | undefined): Promise<void> {
    context.telemetry.properties.deployedWithDefaultApp = 'false';

    const newNodes: SiteTreeItem[] = [];
    let node: SiteTreeItem | undefined;
    let deployFsPath: string | undefined;
    let webAppSource: WebAppSource;

    if (target instanceof vscode.Uri) {
        context.telemetry.properties.deploymentEntryPoint = 'fileExplorerContextMenu';
        deployFsPath = target.fsPath;
        webAppSource = WebAppSource.nodePicker;
    } else {
        context.telemetry.properties.deploymentEntryPoint = target ? 'webAppContextMenu' : 'deployButton';
        webAppSource = target ? WebAppSource.tree : WebAppSource.nodePicker;
        node = target;
    }

    let siteConfig: WebSiteModels.SiteConfigResource | undefined;

    if (!deployFsPath) {
        // we can only get the siteConfig if the entry point was a treeItem
        siteConfig = node ? await node.root.client.getSiteConfig() : undefined;

        if (siteConfig && javaUtils.isJavaRuntime(siteConfig.linuxFxVersion)) {
            const fileExtension: string = javaUtils.getArtifactTypeByJavaRuntime(siteConfig.linuxFxVersion);
            deployFsPath = await workspaceUtil.showWorkspaceFolders(`Select the ${fileExtension} file to deploy...`, context, constants.configurationSettings.deploySubpath, fileExtension);
        } else {
            deployFsPath = await workspaceUtil.showWorkspaceFolders("Select the folder to deploy", context, constants.configurationSettings.deploySubpath);
        }
    }

    const workspace: vscode.WorkspaceFolder | undefined = workspaceUtil.getContainingWorkspace(deployFsPath);
    if (!workspace) {
        throw new Error('Failed to deploy because the path is not part of an open workspace. Open in a workspace and try again.');
    }

    const deployContext: IDeployWizardContext = {
        ...context, workspace, deployFsPath, webAppSource
    };

    if (!node) {
        const onTreeItemCreatedFromQuickPickDisposable: vscode.Disposable = ext.tree.onTreeItemCreate((newNode: SiteTreeItem) => {
            // event is fired from azure-extensionui if node was created during deployment
            newNodes.push(newNode);
        });
        try {
            // tslint:disable-next-line: strict-boolean-expressions
            node = await getDefaultWebAppToDeploy(deployContext) || <SiteTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue, context);
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

    // if we already got siteConfig, don't waste time getting it again
    siteConfig = siteConfig ? siteConfig : await node.root.client.getSiteConfig();

    if (javaUtils.isJavaRuntime(siteConfig.linuxFxVersion)) {
        const javaArtifactFiles: vscode.Uri[] = await workspaceUtil.findFilesByFileExtension(deployContext.deployFsPath, javaUtils.getArtifactTypeByJavaRuntime(siteConfig.linuxFxVersion));
        if (javaArtifactFiles.length > 0) {
            const javaArtifactQp: IAzureQuickPickItem<string>[] = workspaceUtil.mapFilesToQuickPickItems(javaArtifactFiles);
            // check if there is a jar/war file in the fsPath that was provided
            deployContext.deployFsPath = <string>(await ext.ui.showQuickPick(javaArtifactQp, { placeHolder: `Select the ${javaUtils.getArtifactTypeByJavaRuntime(siteConfig.linuxFxVersion)} file to deploy...` })).data;
        }
        await javaUtils.configureJavaSEAppSettings(node);
    }

    // only check enableScmDoBuildDuringDeploy if currentWorkspace matches the workspace being deployed as a user can "Browse" to a different project
    if (getWorkspaceSetting<boolean>(constants.configurationSettings.showBuildDuringDeployPrompt, deployContext.workspace.uri.fsPath)) {
        //check if node is being zipdeployed and that there is no .deployment file
        if (siteConfig.linuxFxVersion && siteConfig.scmType === 'None' && !(await pathExists(path.join(deployContext.workspace.uri.fsPath, constants.deploymentFileName)))) {
            const linuxFxVersion: string = siteConfig.linuxFxVersion.toLowerCase();
            if (linuxFxVersion.startsWith(appservice.LinuxRuntimes.node)) {
                // if it is node or python, prompt the user (as we can break them)
                await node.promptScmDoBuildDeploy(deployContext.workspace.uri.fsPath, appservice.LinuxRuntimes.node, context);
            } else if (linuxFxVersion.startsWith(appservice.LinuxRuntimes.python)) {
                await node.promptScmDoBuildDeploy(deployContext.workspace.uri.fsPath, appservice.LinuxRuntimes.python, context);
            }

        }
    }

    if (confirmDeployment && siteConfig.scmType !== constants.ScmType.LocalGit && siteConfig !== constants.ScmType.GitHub) {
        const warning: string = `Are you sure you want to deploy to "${node.root.client.fullName}"? This will overwrite any previous deployment and cannot be undone.`;
        context.telemetry.properties.cancelStep = 'confirmDestructiveDeployment';
        const items: vscode.MessageItem[] = [constants.AppServiceDialogResponses.deploy];
        const resetDefault: vscode.MessageItem = { title: 'Reset default' };
        if (deployContext.webAppSource === WebAppSource.setting) {
            items.push(resetDefault);
        }
        items.push(DialogResponses.cancel);

        // a temporary workaround for this issue:
        // https://github.com/Microsoft/vscode-azureappservice/issues/844
        await delay(500);

        const result: vscode.MessageItem = await ext.ui.showWarningMessage(warning, { modal: true }, ...items);
        if (result === resetDefault) {
            const settingsPath = path.join(deployContext.workspace.uri.fsPath, '.vscode', 'settings.json');
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(settingsPath));
            vscode.window.showTextDocument(doc);
            await updateWorkspaceSetting(constants.configurationSettings.defaultWebAppToDeploy, '', deployContext.workspace.uri.fsPath);

            // If resetDefault button was clicked we ask what and where to deploy again
            await vscode.commands.executeCommand('appService.Deploy');
            return;
        }
        deployContext.telemetry.properties.cancelStep = '';
    }

    // tslint:disable-next-line:no-floating-promises
    node.promptToSaveDeployDefaults(deployContext, deployContext.workspace.uri.fsPath, deployContext.deployFsPath);

    await appservice.runPreDeployTask(deployContext, deployContext.deployFsPath, siteConfig.scmType, constants.extensionPrefix);

    cancelWebsiteValidation(node);
    await node.runWithTemporaryDescription("Deploying...", async () => {
        await appservice.deploy(nonNullValue(node).root.client, <string>deployContext.deployFsPath, deployContext, constants.showOutputChannelCommandId);
    });

    const deployComplete: string = `Deployment to "${node.root.client.fullName}" completed.`;
    ext.outputChannel.appendLine(deployComplete);
    const browseWebsite: vscode.MessageItem = { title: 'Browse Website' };
    const streamLogs: vscode.MessageItem = { title: 'Stream Logs' };

    // Don't wait
    vscode.window.showInformationMessage(deployComplete, browseWebsite, streamLogs, constants.AppServiceDialogResponses.viewOutput).then(async (result: vscode.MessageItem | undefined) => {
        if (result === constants.AppServiceDialogResponses.viewOutput) {
            ext.outputChannel.show();
        } else if (result === browseWebsite) {
            await nonNullValue(node).browse();
        } else if (result === streamLogs) {
            await startStreamingLogs(deployContext, node);
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

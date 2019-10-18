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
import { DialogResponses, IActionContext, parseError } from 'vscode-azureextensionui';
import * as constants from '../../constants';
import { SiteTreeItem } from '../../explorer/SiteTreeItem';
import { WebAppTreeItem } from '../../explorer/WebAppTreeItem';
import { ext } from '../../extensionVariables';
import { delay } from '../../utils/delay';
import { javaUtils } from '../../utils/javaUtils';
import { nonNullValue } from '../../utils/nonNull';
import { getRandomHexString } from "../../utils/randomUtils";
import * as workspaceUtil from '../../utils/workspace';
import { getWorkspaceSetting, updateWorkspaceSetting } from '../../vsCodeConfig/settings';
import { runPostDeployTask } from '../postDeploy/runPostDeployTask';
import { startStreamingLogs } from '../startStreamingLogs';
import { getWebAppToDeploy } from './getWebAppToDeploy';
import { IDeployContext, WebAppSource } from './IDeployContext';
import { setPreDeployTaskForDotnet } from './setPreDeployTaskForDotnet';

const postDeployCancelTokens: Map<string, vscode.CancellationTokenSource> = new Map();

// tslint:disable-next-line:max-func-body-length cyclomatic-complexity
export async function deploy(context: IActionContext, confirmDeployment: boolean, target?: vscode.Uri | SiteTreeItem | undefined): Promise<void> {
    const newNodes: SiteTreeItem[] = [];
    let node: SiteTreeItem | undefined;
    let webAppSource: WebAppSource | undefined;

    context.telemetry.properties.deployedWithConfigs = 'false';
    let siteConfig: WebSiteModels.SiteConfigResource | undefined;

    if (target instanceof SiteTreeItem) {
        node = target;
        webAppSource = WebAppSource.tree;
        // we can only get the siteConfig earlier if the entry point was a treeItem
        siteConfig = await node.root.client.getSiteConfig();
    }

    let fileExtensions: string | string[] | undefined;
    if (siteConfig && javaUtils.isJavaRuntime(siteConfig.linuxFxVersion)) {
        fileExtensions = javaUtils.getArtifactTypeByJavaRuntime(siteConfig.linuxFxVersion);
    } else if (await javaUtils.isJavaProject()) {
        fileExtensions = javaUtils.getJavaArtifactExtensions();
    }

    const { originalDeployFsPath, effectiveDeployFsPath } = await appservice.getDeployFsPath(target, fileExtensions);
    const workspace: vscode.WorkspaceFolder | undefined = workspaceUtil.getContainingWorkspace(effectiveDeployFsPath);
    if (!workspace) {
        throw new Error('Failed to deploy because the path is not part of an open workspace. Open in a workspace and try again.');
    }

    const deployContext: IDeployContext = {
        ...context, workspace, originalDeployFsPath, effectiveDeployFsPath, webAppSource
    };

    // because this is workspace dependant, do it before user selects app
    await setPreDeployTaskForDotnet(deployContext);
    if (!node) {
        const onTreeItemCreatedFromQuickPickDisposable: vscode.Disposable = ext.tree.onTreeItemCreate((newNode: SiteTreeItem) => {
            // event is fired from azure-extensionui if node was created during deployment
            newNodes.push(newNode);
        });

        try {
            node = await getWebAppToDeploy(deployContext);
        } catch (err2) {
            if (parseError(err2).isUserCancelledError) {
                context.telemetry.properties.cancelStep = `showTreeItemPicker:${WebAppTreeItem.contextValue}`;
            }
            throw err2;
        } finally {
            onTreeItemCreatedFromQuickPickDisposable.dispose();
        }
    }

    context.telemetry.properties.webAppSource = deployContext.webAppSource;

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
    node.promptToSaveDeployDefaults(deployContext, deployContext.workspace.uri.fsPath, deployContext.originalDeployFsPath);
    await appservice.runPreDeployTask(deployContext, deployContext.originalDeployFsPath, siteConfig.scmType);

    // cancellation moved to after prompts while gathering telemetry
    // cancel the previous detector check from the same web app
    const previousTokenSource: vscode.CancellationTokenSource | undefined = postDeployCancelTokens.get(node.id);
    if (previousTokenSource) {
        previousTokenSource.cancel();
    }

    // only respect the deploySubpath settings for zipdeploys
    const deployPath: string = siteConfig.scmType === constants.ScmType.None ? deployContext.effectiveDeployFsPath : deployContext.originalDeployFsPath;

    if (siteConfig.scmType !== constants.ScmType.None && deployContext.effectiveDeployFsPath !== deployContext.originalDeployFsPath) {
        const noSubpathWarning: string = `WARNING: Ignoring deploySubPath "${getWorkspaceSetting(constants.configurationSettings.deploySubpath)}" for non-zip deploy.`;
        ext.outputChannel.appendLog(noSubpathWarning);
    }

    await node.runWithTemporaryDescription("Deploying...", async () => {
        await appservice.deploy(nonNullValue(node).root.client, <string>deployPath, deployContext);
    });

    const tokenSource: vscode.CancellationTokenSource = new vscode.CancellationTokenSource();
    postDeployCancelTokens.set(node.id, tokenSource);

    const deployComplete: string = `Deployment to "${node.root.client.fullName}" completed.`;
    ext.outputChannel.appendLog(deployComplete);
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

    // intentionally not waiting
    // tslint:disable-next-line: no-floating-promises
    runPostDeployTask(node, correlationId, tokenSource);
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WebSiteModels from 'azure-arm-website/lib/models';
import { pathExists } from 'fs-extra';
import * as path from 'path';
import * as git from 'simple-git/promise';
import * as vscode from 'vscode';
import { commands, MessageItem, ProgressLocation, window, workspace, WorkspaceFolder } from 'vscode';
import * as appservice from 'vscode-azureappservice';
import { callWithTelemetryAndErrorHandling, IActionContext } from 'vscode-azureextensionui';
import * as constants from '../../constants';
import { AppServiceDialogResponses } from '../../constants';
import { SiteTreeItem } from '../../explorer/SiteTreeItem';
import { TrialAppTreeItem } from '../../explorer/trialApp/TrialAppTreeItem';
import { ext } from '../../extensionVariables';
import { localize } from '../../localize';
import { javaUtils } from '../../utils/javaUtils';
import { nonNullValue } from '../../utils/nonNull';
import { isPathEqual } from '../../utils/pathUtils';
import { getRandomHexString } from "../../utils/randomUtils";
import { getWorkspaceSetting } from '../../vsCodeConfig/settings';
import { runPostDeployTask } from '../postDeploy/runPostDeployTask';
import { confirmDeploymentPrompt } from './confirmDeploymentPrompt';
import { getDeployNode, IDeployNode } from './getDeployNode';
import { IDeployContext, WebAppSource } from './IDeployContext';
import { promptScmDoBuildDeploy } from './promptScmDoBuildDeploy';
import { promptToSaveDeployDefaults } from './promptToSaveDeployDefaults';
import { setPreDeployTaskForDotnet } from './setPreDeployTaskForDotnet';
import { showDeployCompletedMessage } from './showDeployCompletedMessage';

const postDeployCancelTokens: Map<string, vscode.CancellationTokenSource> = new Map();

export async function deploy(context: IActionContext, target?: vscode.Uri | SiteTreeItem | TrialAppTreeItem, _multiTargets?: (vscode.Uri | SiteTreeItem)[], isTargetNewWebApp: boolean = false): Promise<void> {
    let webAppSource: WebAppSource | undefined;
    context.telemetry.properties.deployedWithConfigs = 'false';
    let siteConfig: WebSiteModels.SiteConfigResource | undefined;

    if (target instanceof TrialAppTreeItem) {
        return await deployTrialApp(target);
    }

    const trialAppTreeItem: TrialAppTreeItem | undefined = await shouldDeployTrialApp(target);
    if (trialAppTreeItem) {
        return await deployTrialApp(trialAppTreeItem);
    }

    if (target instanceof SiteTreeItem) {
        webAppSource = WebAppSource.tree;
        // we can only get the siteConfig earlier if the entry point was a treeItem
        siteConfig = await target.root.client.getSiteConfig();
    }

    const fileExtensions: string | string[] | undefined = await javaUtils.getJavaFileExtensions(siteConfig);

    const { originalDeployFsPath, effectiveDeployFsPath, workspaceFolder } = await appservice.getDeployFsPath(context, target, fileExtensions);

    const deployContext: IDeployContext = {
        ...context, workspace: workspaceFolder, originalDeployFsPath, effectiveDeployFsPath, webAppSource
    };

    // because this is workspace dependant, do it before user selects app
    await setPreDeployTaskForDotnet(deployContext);
    const { node, isNewWebApp }: IDeployNode = await getDeployNode(deployContext, target, isTargetNewWebApp);

    context.telemetry.properties.webAppSource = deployContext.webAppSource;

    const correlationId = getRandomHexString();
    context.telemetry.properties.correlationId = correlationId;

    // if we already got siteConfig, don't waste time getting it again
    siteConfig = siteConfig ? siteConfig : await node.root.client.getSiteConfig();

    if (javaUtils.isJavaRuntime(siteConfig.linuxFxVersion)) {
        await javaUtils.configureJavaSEAppSettings(node);
    }

    const isZipDeploy: boolean = siteConfig.scmType !== constants.ScmType.LocalGit && siteConfig !== constants.ScmType.GitHub;
    // only check enableScmDoBuildDuringDeploy if currentWorkspace matches the workspace being deployed as a user can "Browse" to a different project
    if (getWorkspaceSetting<boolean>(constants.configurationSettings.showBuildDuringDeployPrompt, deployContext.effectiveDeployFsPath)) {
        //check if node is being zipdeployed and that there is no .deployment file
        if (siteConfig.linuxFxVersion && isZipDeploy && !(await pathExists(path.join(deployContext.effectiveDeployFsPath, constants.deploymentFileName)))) {
            const linuxFxVersion: string = siteConfig.linuxFxVersion.toLowerCase();
            if (linuxFxVersion.startsWith(appservice.LinuxRuntimes.node)) {
                // if it is node or python, prompt the user (as we can break them)
                await promptScmDoBuildDeploy(context, deployContext.effectiveDeployFsPath, appservice.LinuxRuntimes.node);
            } else if (linuxFxVersion.startsWith(appservice.LinuxRuntimes.python)) {
                await promptScmDoBuildDeploy(context, deployContext.effectiveDeployFsPath, appservice.LinuxRuntimes.python);
            }

        }
    }

    if (getWorkspaceSetting<boolean>('showDeployConfirmation', workspaceFolder.uri.fsPath) && !isNewWebApp && isZipDeploy) {
        await confirmDeploymentPrompt(deployContext, context, node.root.client.fullName);
    }

    // tslint:disable-next-line:no-floating-promises
    promptToSaveDeployDefaults(context, node, deployContext.workspace.uri.fsPath, deployContext.effectiveDeployFsPath);
    await appservice.runPreDeployTask(deployContext, deployContext.originalDeployFsPath, siteConfig.scmType);

    // cancellation moved to after prompts while gathering telemetry
    // cancel the previous detector check from the same web app
    const previousTokenSource: vscode.CancellationTokenSource | undefined = postDeployCancelTokens.get(node.id);
    if (previousTokenSource) {
        previousTokenSource.cancel();
    }

    // only respect the deploySubpath settings for zipdeploys
    const deployPath: string = isZipDeploy ? deployContext.effectiveDeployFsPath : deployContext.originalDeployFsPath;

    if (!isZipDeploy && isPathEqual(deployContext.effectiveDeployFsPath, deployContext.originalDeployFsPath)) {
        const noSubpathWarning: string = `WARNING: Ignoring deploySubPath "${getWorkspaceSetting(constants.configurationSettings.deploySubpath)}" for non-zip deploy.`;
        ext.outputChannel.appendLog(noSubpathWarning);
    }

    await node.runWithTemporaryDescription("Deploying...", async () => {
        await appservice.deploy(nonNullValue(node).root.client, <string>deployPath, deployContext);
    });

    const tokenSource: vscode.CancellationTokenSource = new vscode.CancellationTokenSource();
    postDeployCancelTokens.set(node.id, tokenSource);

    showDeployCompletedMessage(node);

    // don't wait
    // tslint:disable-next-line: no-floating-promises
    runPostDeployTask(node, correlationId, tokenSource);
}

async function shouldDeployTrialApp(target: vscode.Uri | SiteTreeItem | undefined): Promise<TrialAppTreeItem | undefined> {
    const trialAppTreeItem: TrialAppTreeItem | undefined = ext.azureAccountTreeItem.trialAppTreeItem;
    if (target === undefined && trialAppTreeItem) {
        const response: vscode.QuickPickItem = await ext.ui.showQuickPick([{ label: 'Deploy to trial app' }, { label: 'Deploy to web app' }], { placeHolder: '' });
        if (response.label === 'Deploy to trial app') {
            return trialAppTreeItem;
        }
    }
    return undefined;
}

async function deployTrialApp(trialAppTreeItem: TrialAppTreeItem): Promise<void> {
    const trialAppNotFoundError: Error = Error(localize('unableToDeployTrialApp', 'Unable to deploy trial app: Clone trial app source and open folder in VS Code to deploy'));
    const title: string = localize('deploying', 'Deploying to "{0}"... Check [output window](command:{1}) for status.', trialAppTreeItem.metadata.siteName, `${ext.prefix}.showOutputChannel`);

    const workspaceFolders: WorkspaceFolder[] | undefined = workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length < 0) {
        const trialAppPath = workspaceFolders.find((folder: WorkspaceFolder) => {
            return folder.name === trialAppTreeItem.metadata.siteName;
        });
        if (trialAppPath) {
            await window.withProgress({ location: ProgressLocation.Notification, title }, async () => {

                // the -a flag stages all changes before committing
                ext.outputChannel.appendLog(localize('committingChanges', 'Committing changes'));
                await git(trialAppPath.uri.fsPath).commit('Deploy trial app', undefined, { '-a': null });
                ext.outputChannel.appendLog(localize('pushingToRemote', 'Pushing to deploy changes'));
                await commands.executeCommand('git.push');
                // use showDeployCompletedMessage when able
                const message: string = localize('deployCompleted', 'Deployment to trial app "{0}" completed.', trialAppTreeItem.metadata.siteName);
                ext.outputChannel.appendLog(message);
                const browseWebsiteBtn: MessageItem = { title: localize('browseWebsite', 'Browse Website') };
                const streamLogs: MessageItem = { title: localize('streamLogs', 'Stream Logs') };

                // don't wait
                window.showInformationMessage(message, browseWebsiteBtn, streamLogs, AppServiceDialogResponses.viewOutput).then(async (result: MessageItem | undefined) => {
                    await callWithTelemetryAndErrorHandling('postDeploy', async (context: IActionContext) => {
                        context.telemetry.properties.dialogResult = result?.title;
                        if (result === AppServiceDialogResponses.viewOutput) {
                            ext.outputChannel.show();
                        } else if (result === browseWebsiteBtn) {
                            await trialAppTreeItem.browse();
                        }
                    });
                });
            });
        } else {
            const clone: MessageItem = { title: 'Clone trial app' };
            await window.showErrorMessage(trialAppNotFoundError.message, clone).then((value: MessageItem) => {
                if (value === clone) {
                    vscode.commands.executeCommand('git.clone', trialAppTreeItem.metadata.gitUrl);
                }
            });
            return;
        }
    } else {
        throw trialAppNotFoundError;
    }
}

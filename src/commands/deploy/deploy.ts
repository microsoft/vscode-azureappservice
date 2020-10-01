/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WebSiteModels from 'azure-arm-website/lib/models';
import { pathExists } from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import * as appservice from 'vscode-azureappservice';
import { getDeployFsPath, getDeployNode, IDeployContext, IDeployPaths, showDeployConfirmation } from 'vscode-azureappservice';
import { IActionContext } from 'vscode-azureextensionui';
import * as constants from '../../constants';
import { SiteTreeItem } from '../../explorer/SiteTreeItem';
import { TrialAppTreeItem } from '../../explorer/trialApp/TrialAppTreeItem';
import { WebAppTreeItem } from '../../explorer/WebAppTreeItem';
import { ext } from '../../extensionVariables';
import { javaUtils } from '../../utils/javaUtils';
import { nonNullValue } from '../../utils/nonNull';
import { isPathEqual } from '../../utils/pathUtils';
import { getRandomHexString } from "../../utils/randomUtils";
import { getWorkspaceSetting } from '../../vsCodeConfig/settings';
import { runPostDeployTask } from '../postDeploy/runPostDeployTask';
import { deployTrialApp } from './deployTrialApp';
import { enableScmDoBuildDuringDeploy, promptScmDoBuildDeploy } from './promptScmDoBuildDeploy';
import { promptToSaveDeployDefaults, saveDeployDefaults } from './promptToSaveDeployDefaults';
import { setPreDeployTaskForDotnet } from './setPreDeployTaskForDotnet';
import { showDeployCompletedMessage } from './showDeployCompletedMessage';

const postDeployCancelTokens: Map<string, vscode.CancellationTokenSource> = new Map();

export async function deploy(actionContext: IActionContext, arg1?: vscode.Uri | SiteTreeItem | TrialAppTreeItem, arg2?: (vscode.Uri | SiteTreeItem)[], isNewApp: boolean = false): Promise<void> {
    actionContext.telemetry.properties.deployedWithConfigs = 'false';
    let siteConfig: WebSiteModels.SiteConfigResource | undefined;

    if (arg1 instanceof SiteTreeItem) {
        // we can only get the siteConfig earlier if the entry point was a treeItem
        siteConfig = await arg1.root.client.getSiteConfig();
    }

    const fileExtensions: string | string[] | undefined = await javaUtils.getJavaFileExtensions(siteConfig);

    const deployPaths: IDeployPaths = await getDeployFsPath(actionContext, arg1, fileExtensions);
    const context: IDeployContext = Object.assign(actionContext, deployPaths, { defaultAppSetting: constants.configurationSettings.defaultWebAppToDeploy, isNewApp });

    // because this is workspace dependant, do it before user selects app
    await setPreDeployTaskForDotnet(context);
    const node: SiteTreeItem | TrialAppTreeItem = await getDeployNode(context, ext.tree, arg1, arg2, [WebAppTreeItem.contextValue, TrialAppTreeItem.contextValue]);

    if (node instanceof TrialAppTreeItem) {
        await enableScmDoBuildDuringDeploy(context.effectiveDeployFsPath, 'NODE|12-lts');
        if (!ext.azureAccountTreeItem.isLoggedIn) {
            await saveDeployDefaults(node.fullId, context.workspaceFolder.uri.fsPath, context.effectiveDeployFsPath);
        }
        await deployTrialApp(context, node);
        return;
    }

    const correlationId: string = getRandomHexString();
    context.telemetry.properties.correlationId = correlationId;

    // if we already got siteConfig, don't waste time getting it again
    siteConfig = siteConfig ? siteConfig : await node.root.client.getSiteConfig();

    if (javaUtils.isJavaRuntime(siteConfig.linuxFxVersion)) {
        await javaUtils.configureJavaSEAppSettings(node);
    }

    const isZipDeploy: boolean = siteConfig.scmType !== constants.ScmType.LocalGit && siteConfig !== constants.ScmType.GitHub;
    // only check enableScmDoBuildDuringDeploy if currentWorkspace matches the workspace being deployed as a user can "Browse" to a different project
    if (getWorkspaceSetting<boolean>(constants.configurationSettings.showBuildDuringDeployPrompt, context.effectiveDeployFsPath)) {
        //check if node is being zipdeployed and that there is no .deployment file
        if (siteConfig.linuxFxVersion && isZipDeploy && !(await pathExists(path.join(context.effectiveDeployFsPath, constants.deploymentFileName)))) {
            const linuxFxVersion: string = siteConfig.linuxFxVersion.toLowerCase();
            if (linuxFxVersion.startsWith(appservice.LinuxRuntimes.node)) {
                // if it is node or python, prompt the user (as we can break them)
                await promptScmDoBuildDeploy(context, context.effectiveDeployFsPath, appservice.LinuxRuntimes.node);
            } else if (linuxFxVersion.startsWith(appservice.LinuxRuntimes.python)) {
                await promptScmDoBuildDeploy(context, context.effectiveDeployFsPath, appservice.LinuxRuntimes.python);
            }

        }
    }

    if (getWorkspaceSetting<boolean>('showDeployConfirmation', context.workspaceFolder.uri.fsPath) && !context.isNewApp && isZipDeploy) {
        await showDeployConfirmation(context, node.client, 'appService.Deploy');
    }

    // tslint:disable-next-line:no-floating-promises
    promptToSaveDeployDefaults(context, node, context.workspaceFolder.uri.fsPath, context.effectiveDeployFsPath);
    await appservice.runPreDeployTask(context, context.originalDeployFsPath, siteConfig.scmType);

    // cancellation moved to after prompts while gathering telemetry
    // cancel the previous detector check from the same web app
    const previousTokenSource: vscode.CancellationTokenSource | undefined = postDeployCancelTokens.get(node.id);
    if (previousTokenSource) {
        previousTokenSource.cancel();
    }

    // only respect the deploySubpath settings for zipdeploys
    const deployPath: string = isZipDeploy ? context.effectiveDeployFsPath : context.originalDeployFsPath;

    if (!isZipDeploy && isPathEqual(context.effectiveDeployFsPath, context.originalDeployFsPath)) {
        const noSubpathWarning: string = `WARNING: Ignoring deploySubPath "${getWorkspaceSetting(constants.configurationSettings.deploySubpath)}" for non-zip deploy.`;
        ext.outputChannel.appendLog(noSubpathWarning);
    }

    await node.runWithTemporaryDescription("Deploying...", async () => {
        await appservice.deploy(nonNullValue(node).root.client, <string>deployPath, context);
    });

    const tokenSource: vscode.CancellationTokenSource = new vscode.CancellationTokenSource();
    postDeployCancelTokens.set(node.id, tokenSource);

    showDeployCompletedMessage(node);

    // don't wait
    // tslint:disable-next-line: no-floating-promises
    runPostDeployTask(node, correlationId, tokenSource);
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type SiteConfigResource, type StringDictionary } from '@azure/arm-appservice';
import * as appservice from '@microsoft/vscode-azext-azureappservice';
import { getDeployFsPath, getDeployNode, showDeployConfirmation, type IDeployContext, type IDeployPaths, type SiteClient } from '@microsoft/vscode-azext-azureappservice';
import { parseError, type IActionContext } from '@microsoft/vscode-azext-utils';
import { pathExists } from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import * as constants from '../../constants';
import { ext } from '../../extensionVariables';
import { localize } from '../../localize';
import { ResolvedWebAppResource } from '../../tree/ResolvedWebAppResource';
import { type SiteTreeItem } from '../../tree/SiteTreeItem';
import { createActivityContext } from '../../utils/activityUtils';
import { javaUtils } from '../../utils/javaUtils';
import { nonNullValue } from '../../utils/nonNull';
import { isPathEqual } from '../../utils/pathUtils';
import { getRandomHexString } from "../../utils/randomUtils";
import { treeUtils } from '../../utils/treeUtils';
import { getWorkspaceSetting } from '../../vsCodeConfig/settings';
import { LinuxRuntimes } from '../createWebApp/LinuxRuntimes';
import { runPostDeployTask } from '../postDeploy/runPostDeployTask';
import { failureMoreInfoSurvey } from './failureMoreInfoSurvey';
import { getDomainNameLabelScope } from './getDomainNameLabelScope';
import { promptScmDoBuildDeploy } from './promptScmDoBuildDeploy';
import { promptToSaveDeployDefaults } from './promptToSaveDeployDefaults';
import { setPreDeployConfig } from './setPreDeployConfig';
import { showDeployCompletedMessage } from './showDeployCompletedMessage';

const postDeployCancelTokens: Map<string, vscode.CancellationTokenSource> = new Map<string, vscode.CancellationTokenSource>();

export async function deploy(actionContext: IActionContext, arg1?: vscode.Uri | SiteTreeItem, arg2?: (vscode.Uri | SiteTreeItem)[], isNewApp: boolean = false): Promise<void> {
    actionContext.telemetry.properties.deployedWithConfigs = 'false';
    let siteConfig: SiteConfigResource | undefined;
    let client: SiteClient;

    if (treeUtils.isAzExtTreeItem(arg1)) {
        if (!arg1.contextValue.match(ResolvedWebAppResource.webAppContextValue) &&
            !arg1.contextValue.match(ResolvedWebAppResource.slotContextValue)) {
            // if the user uses the deploy button, it's possible for the local node to be passed in, so we should reset it to undefined
            arg1 = undefined;
        } else {
            await arg1.initSite(actionContext);
            client = await arg1.site.createClient(actionContext);
            // we can only get the siteConfig earlier if the entry point was a treeItem
            siteConfig = await client.getSiteConfig();
        }
    }

    const fileExtensions: string | string[] | undefined = await javaUtils.getJavaFileExtensions(siteConfig);

    const deployPaths: IDeployPaths = await getDeployFsPath(actionContext, arg1, fileExtensions);
    const context: IDeployContext = Object.assign(actionContext, deployPaths, { defaultAppSetting: constants.configurationSettings.defaultWebAppToDeploy, isNewApp });

    // because this is workspace dependant, do it before user selects app
    await setPreDeployConfig(context);
    const node: SiteTreeItem = await getDeployNode(context, ext.rgApi.tree, arg1, arg2, () => ext.rgApi.pickAppResource(context, {
        filter: constants.webAppFilter
    }));
    await node.initSite(context);
    client = await node.site.createClient(actionContext);

    const correlationId: string = getRandomHexString();
    context.telemetry.properties.correlationId = correlationId;
    context.telemetry.properties.siteLocation = node.site.location;
    context.telemetry.properties.siteDomainNameLabelScope = await getDomainNameLabelScope(Object.assign(context, node.subscription), node.site.resourceGroup, node.site.siteName);

    // if we already got siteConfig, don't waste time getting it again
    siteConfig = siteConfig ? siteConfig : await client.getSiteConfig();

    if (javaUtils.isJavaRuntime(siteConfig)) {
        await javaUtils.configureJavaSEAppSettings(context, node);
    }

    const isZipDeploy: boolean = siteConfig.scmType !== constants.ScmType.LocalGit && siteConfig.scmType !== constants.ScmType.GitHub;
    // only check enableScmDoBuildDuringDeploy if currentWorkspace matches the workspace being deployed as a user can "Browse" to a different project
    if (getWorkspaceSetting<boolean>(constants.configurationSettings.showBuildDuringDeployPrompt, context.effectiveDeployFsPath)) {
        const remoteSettings: StringDictionary = await client.listApplicationSettings();
        const hasSCMDoBuildSetting: boolean = !!remoteSettings.properties && 'SCM_DO_BUILD_DURING_DEPLOYMENT' in remoteSettings.properties;
        //check if node is being zipdeployed and that there is no .deployment file
        if (!hasSCMDoBuildSetting && siteConfig.linuxFxVersion && isZipDeploy && !(await pathExists(path.join(context.effectiveDeployFsPath, constants.deploymentFileName)))) {
            const linuxFxVersion: string = siteConfig.linuxFxVersion.toLowerCase();
            if (linuxFxVersion.startsWith(LinuxRuntimes.node)) {
                // if it is node or python, prompt the user (as we can break them)
                await promptScmDoBuildDeploy(context, context.effectiveDeployFsPath, LinuxRuntimes.node);
            } else if (linuxFxVersion.startsWith(LinuxRuntimes.python)) {
                await promptScmDoBuildDeploy(context, context.effectiveDeployFsPath, LinuxRuntimes.python);
            }
        }
    }

    if (getWorkspaceSetting<boolean>('showDeployConfirmation', context.workspaceFolder.uri.fsPath) && !context.isNewApp && isZipDeploy) {
        await showDeployConfirmation(context, node.site, 'appService.Deploy');
    }

    void promptToSaveDeployDefaults(context, node, context.workspaceFolder.uri.fsPath, context.effectiveDeployFsPath);
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
        const noSubpathWarning: string = localize('ignoreSuppath', 'WARNING: Ignoring deploySubPath "{0}" for non-zip deploy.', getWorkspaceSetting(constants.configurationSettings.deploySubpath));
        ext.outputChannel.appendLog(noSubpathWarning);
    }

    await node.runWithTemporaryDescription(context, localize('deploying', "Deploying..."), async () => {
        try {
            const deployContext = Object.assign(context, await createActivityContext());
            deployContext.activityChildren = [];
            await appservice.deploy(nonNullValue(node).site, <string>deployPath, deployContext);
        } catch (error) {
            if (!actionContext.errorHandling.suppressDisplay
                && failureMoreInfoSurvey(parseError(error), nonNullValue(siteConfig))) {
                actionContext.errorHandling.suppressDisplay = true;
            }
            throw error;
        }
    });

    const tokenSource: vscode.CancellationTokenSource = new vscode.CancellationTokenSource();
    postDeployCancelTokens.set(node.id, tokenSource);

    showDeployCompletedMessage(context, node);

    runPostDeployTask(context, node, correlationId, tokenSource);
}

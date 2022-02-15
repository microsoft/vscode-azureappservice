/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DialogResponses, IActionContext } from "@microsoft/vscode-azext-utils";
import * as path from 'path';
import { MessageItem } from "vscode";
import * as constants from '../../constants';
import { localize } from '../../localize';
import { SiteTreeItem } from '../../tree/SiteTreeItem';
import { getWorkspaceSetting, updateWorkspaceSetting } from "../../vsCodeConfig/settings";

export async function promptToSaveDeployDefaults(context: IActionContext, node: SiteTreeItem, workspacePath: string, deployPath: string): Promise<void> {
    const defaultWebAppToDeploySetting: string | undefined = getWorkspaceSetting(constants.configurationSettings.defaultWebAppToDeploy, workspacePath);
    // only prompt if setting is unset
    if (!defaultWebAppToDeploySetting) {
        const saveDeploymentConfig: string = localize('showDeploymentConfig', 'Always deploy the workspace "{0}" to "{1}"?', path.relative(workspacePath, deployPath) ? deployPath : path.basename(workspacePath), node.site.fullName);
        const dontShowAgain: MessageItem = { title: localize('dontShow', "Don't show again") };
        const result: MessageItem = await context.ui.showWarningMessage(saveDeploymentConfig, DialogResponses.yes, dontShowAgain, DialogResponses.skipForNow);
        if (result === DialogResponses.yes) {
            await saveDeployDefaults(node.fullId, workspacePath, deployPath);
            context.telemetry.properties.promptToSaveDeployConfigs = 'Yes';
        } else if (result === dontShowAgain) {
            await updateWorkspaceSetting(constants.configurationSettings.defaultWebAppToDeploy, constants.none, deployPath);
            context.telemetry.properties.promptToSaveDeployConfigs = "Don't show again";
        } else {
            context.telemetry.properties.promptToSaveDeployConfigs = 'Skip for now';
        }
    } else {
        context.telemetry.properties.promptToSaveDeployConfigs = defaultWebAppToDeploySetting === constants.none ? constants.none : 'usesDefault';
    }
}

export async function saveDeployDefaults(nodeFullId: string, workspacePath: string, deployPath: string): Promise<void> {
    await updateWorkspaceSetting(constants.configurationSettings.defaultWebAppToDeploy, nodeFullId, deployPath);
    const subPath: string = path.relative(workspacePath, deployPath) || '.';
    await updateWorkspaceSetting(constants.configurationSettings.deploySubpath, subPath, deployPath);
}

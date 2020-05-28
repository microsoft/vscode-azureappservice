/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { MessageItem } from "vscode";
import { DialogResponses, IActionContext } from "vscode-azureextensionui";
import * as constants from '../constants';
import { SiteTreeItem } from '../explorer/SiteTreeItem';
import { ext } from "../extensionVariables";
import { getWorkspaceSetting, updateWorkspaceSetting } from "../vsCodeConfig/settings";

export async function promptToSaveDeployDefaults(context: IActionContext, node: SiteTreeItem, workspacePath: string, deployPath: string): Promise<void> {
    const defaultWebAppToDeploySetting: string | undefined = getWorkspaceSetting(constants.configurationSettings.defaultWebAppToDeploy, workspacePath);
    // only prompt if setting is unset
    if (!defaultWebAppToDeploySetting) {
        const saveDeploymentConfig: string = `Always deploy the workspace "${path.basename(workspacePath)}" to "${node.root.client.fullName}"?`;
        const dontShowAgain: MessageItem = { title: "Don't show again" };
        const result: MessageItem = await ext.ui.showWarningMessage(saveDeploymentConfig, DialogResponses.yes, dontShowAgain, DialogResponses.skipForNow);
        if (result === DialogResponses.yes) {
            await updateWorkspaceSetting(constants.configurationSettings.defaultWebAppToDeploy, node.fullId, deployPath);
            // tslint:disable-next-line: strict-boolean-expressions
            const subPath: string = path.relative(workspacePath, deployPath) || '.';
            await updateWorkspaceSetting(constants.configurationSettings.deploySubpath, subPath, deployPath);
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

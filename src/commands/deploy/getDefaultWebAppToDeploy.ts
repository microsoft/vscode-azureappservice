/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { workspace, WorkspaceFolder } from "vscode";
import { configurationSettings, none } from "../../constants";
import { WebAppTreeItem } from "../../explorer/WebAppTreeItem";
import { ext } from '../../extensionVariables';
import { getContainingWorkspace } from "../../utils/workspace";
import { getGlobalSetting, getWorkspaceSetting, updateGlobalSetting, updateWorkspaceSetting } from "../../vsCodeConfig/settings";
import { IDeployWizardContext } from "../createWebApp/setAppWizardContextDefault";

export async function getDefaultWebAppToDeploy(context: IDeployWizardContext): Promise<WebAppTreeItem | undefined> {
    const workspaceFolder: WorkspaceFolder | undefined = context.fsPath ?
        getContainingWorkspace(context.fsPath) : workspace.workspaceFolders && workspace.workspaceFolders.length === 1 ?
            workspace.workspaceFolders[0] : undefined;

    const defaultWebAppId: string | undefined = workspaceFolder ? getWorkspaceSetting(configurationSettings.defaultWebAppToDeploy, workspaceFolder.uri.fsPath) : getGlobalSetting(configurationSettings.defaultWebAppToDeploy);

    if (defaultWebAppId && defaultWebAppId !== none) {
        const defaultWebApp: WebAppTreeItem | undefined = await ext.tree.findTreeItem(defaultWebAppId, context); // resolves to undefined if app can't be found
        if (defaultWebApp) {
            context.deployedWithConfigs = true;
            context.telemetry.properties.deployedWithConfigs = 'true';
            return <WebAppTreeItem>defaultWebApp;
        } else {
            // if defaultPath or defaultNode cannot be found or there was a mismatch, delete old settings and prompt to save next deployment
            workspaceFolder ? updateWorkspaceSetting(configurationSettings.defaultWebAppToDeploy, undefined, workspaceFolder.uri.fsPath) : updateGlobalSetting(configurationSettings.defaultWebAppToDeploy, undefined);
        }
    }

    return undefined;
}

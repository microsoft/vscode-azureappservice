/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConfigurationTarget, workspace, WorkspaceConfiguration, WorkspaceFolder } from "vscode";
import { IDeployWizardContext } from "../commands/createWebApp/setAppWizardContextDefault";
import { configurationSettings, extensionPrefix, none } from "../constants";
import { WebAppTreeItem } from "../explorer/WebAppTreeItem";
import { ext } from '../extensionVariables';
import { getContainingWorkspace } from "../utils/workspace";

export async function getDefaultWebAppToDeploy(context: IDeployWizardContext): Promise<WebAppTreeItem | undefined> {
    const workspaceFolder: WorkspaceFolder | undefined = context.fsPath ?
        getContainingWorkspace(context.fsPath) : workspace.workspaceFolders && workspace.workspaceFolders.length === 1 ?
            workspace.workspaceFolders[0] : undefined;

    const workspaceConfig: WorkspaceConfiguration = workspace.getConfiguration(extensionPrefix, workspaceFolder ? workspaceFolder.uri : undefined);
    context.configurationTarget = workspaceFolder ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Global;
    const defaultWebAppId: string | undefined = workspaceConfig.get(configurationSettings.defaultWebAppToDeploy);

    if (defaultWebAppId && defaultWebAppId !== none) {
        const defaultWebApp: WebAppTreeItem | undefined = await ext.tree.findTreeItem(defaultWebAppId, context); // resolves to undefined if app can't be found
        if (defaultWebApp) {
            context.deployedWithConfigs = true;
            context.telemetry.properties.deployedWithConfigs = 'true';
            return <WebAppTreeItem>defaultWebApp;
        } else {
            // if defaultPath or defaultNode cannot be found or there was a mismatch, delete old settings and prompt to save next deployment
            workspaceConfig.update(configurationSettings.defaultWebAppToDeploy, undefined, context.configurationTarget);
        }
    }

    return undefined;
}

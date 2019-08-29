/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { configurationSettings, none } from "../../constants";
import { WebAppTreeItem } from "../../explorer/WebAppTreeItem";
import { ext } from '../../extensionVariables';
import { getWorkspaceSetting, updateWorkspaceSetting } from "../../vsCodeConfig/settings";
import { IDeployWizardContext, WebAppSource } from "./IDeployWizardContext";

export async function getWebAppToDeploy(context: IDeployWizardContext): Promise<WebAppTreeItem> {
    const defaultWebAppId: string | undefined = getWorkspaceSetting(configurationSettings.defaultWebAppToDeploy, context.workspace.uri.fsPath);
    if (defaultWebAppId && defaultWebAppId !== none) {
        const defaultWebApp: WebAppTreeItem | undefined = await ext.tree.findTreeItem(defaultWebAppId, context); // resolves to undefined if app can't be found
        if (defaultWebApp) {
            context.webAppSource = WebAppSource.setting;
            return <WebAppTreeItem>defaultWebApp;
        } else {
            // if defaultPath or defaultNode cannot be found or there was a mismatch, delete old settings and prompt to save next deployment
            await updateWorkspaceSetting(configurationSettings.defaultWebAppToDeploy, undefined, context.workspace.uri.fsPath);
        }
    }

    context.webAppSource = WebAppSource.nodePicker;
    return await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue, context);
}

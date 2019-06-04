/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConfigurationTarget, workspace, WorkspaceConfiguration } from 'vscode';
import { AzureParentTreeItem, IActionContext, parseError } from "vscode-azureextensionui";
import { configurationSettings, extensionPrefix, turnOnAdvancedCreation } from "../constants";
import { SubscriptionTreeItem } from '../explorer/SubscriptionTreeItem';
import { WebAppTreeItem } from "../explorer/WebAppTreeItem";
import { ext } from "../extensionVariables";

export async function createWebApp(context: IActionContext, node?: AzureParentTreeItem | undefined): Promise<void> {
    if (!node) {
        node = <AzureParentTreeItem>await ext.tree.showTreeItemPicker(SubscriptionTreeItem.contextValue, context);
    }

    let newSite: WebAppTreeItem | undefined;
    try {
        newSite = <WebAppTreeItem>await node.createChild(context);
    } catch (error) {
        const workspaceConfig: WorkspaceConfiguration = workspace.getConfiguration(extensionPrefix);
        const advancedCreation: boolean | undefined = workspaceConfig.get(configurationSettings.advancedCreation);
        if (!parseError(error).isUserCancelledError && !advancedCreation) {

            const message: string = `Modify the setting "${extensionPrefix}.${configurationSettings.advancedCreation}" if you want to change the default values when creating a Web App in Azure.`;
            // tslint:disable-next-line: no-floating-promises
            ext.ui.showWarningMessage(message, turnOnAdvancedCreation).then(async result => {
                if (result === turnOnAdvancedCreation) {
                    await workspaceConfig.update('advancedCreation', true, ConfigurationTarget.Global);
                }
            });
        }
        throw error;
    }

    newSite.showCreatedOutput(context);
}

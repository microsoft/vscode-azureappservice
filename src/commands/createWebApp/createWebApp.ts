/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConfigurationTarget, MessageItem, workspace, WorkspaceConfiguration } from 'vscode';
import { IAppServiceWizardContext, WebsiteOS } from 'vscode-azureappservice';
import { AzureParentTreeItem, parseError } from "vscode-azureextensionui";
import { configurationSettings, extensionPrefix } from "../../constants";
import { SubscriptionTreeItem } from '../../explorer/SubscriptionTreeItem';
import { WebAppTreeItem } from "../../explorer/WebAppTreeItem";
import { ext } from "../../extensionVariables";

export async function createWebApp(
    context: IAppServiceWizardContext,
    node?: AzureParentTreeItem | undefined,
    createOptions?: {
        subscriptionId?: string,
        siteName?: string,
        rgName?: string,
        os?: WebsiteOS,
        runtime?: string
    }
): Promise<void> {

    // set defaults if parameters were passed in
    if (createOptions) {
        node = createOptions.subscriptionId ? await ext.tree.findTreeItem(`/subscriptions/${createOptions.subscriptionId}/`, context) : undefined;
        context.newSiteName = createOptions.siteName;
        context.newResourceGroupName = createOptions.rgName;
        context.newSiteOS = createOptions.os;
        context.newSiteRuntime = createOptions.runtime;
    }

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
            const btn: MessageItem = { title: 'Turn on advanced creation' };
            // tslint:disable-next-line: no-floating-promises
            ext.ui.showWarningMessage(message, btn).then(async result => {
                if (result === btn) {
                    await workspaceConfig.update('advancedCreation', true, ConfigurationTarget.Global);
                }
            });
        }
        throw error;
    }

    newSite.promptToDeploy(context);
}

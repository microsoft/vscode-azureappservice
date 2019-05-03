
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteConfigResource } from "azure-arm-website/lib/models";
import { MessageItem, window } from 'vscode';
import { AzureParentTreeItem, IActionContext, SubscriptionTreeItem } from "vscode-azureextensionui";
import { WebAppTreeItem } from "../explorer/WebAppTreeItem";
import { ext } from "../extensionVariables";
import { deploy } from "./deploy";

const yesButton: MessageItem = { title: 'Yes' };
const noButton: MessageItem = { title: 'No', isCloseAffordance: true };

export async function createWebApp(actionContext: IActionContext, node?: AzureParentTreeItem | undefined): Promise<void> {
    if (!node) {
        node = <AzureParentTreeItem>await ext.tree.showTreeItemPicker(SubscriptionTreeItem.contextValue);
    }

    const createdApp = <WebAppTreeItem>await node.createChild(actionContext);
    createdApp.root.client.getSiteConfig().then(
        (createdAppConfig: SiteConfigResource) => {
            actionContext.properties.linuxFxVersion = createdAppConfig.linuxFxVersion ? createdAppConfig.linuxFxVersion : 'undefined';
            actionContext.properties.createdFromDeploy = 'false';
        },
        () => {
            // ignore
        });

    // prompt user to deploy to newly created web app
    window.showInformationMessage('Deploy to web app?', yesButton, noButton).then(
        async (input: MessageItem) => {
            if (input === yesButton) {
                await deploy(actionContext, false, createdApp);
            }
        });
}

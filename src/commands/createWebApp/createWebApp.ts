/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageItem, window } from "vscode";
import { AzureParentTreeItem, callWithTelemetryAndErrorHandling, IActionContext, ICreateChildImplContext, parseError } from "vscode-azureextensionui";
import { SubscriptionTreeItem } from '../../explorer/SubscriptionTreeItem';
import { WebAppTreeItem } from "../../explorer/WebAppTreeItem";
import { ext } from "../../extensionVariables";
import { localize } from "../../localize";
import { showCreatedWebAppMessage } from "./showCreatedWebAppMessage";

export async function createWebApp(context: IActionContext & Partial<ICreateChildImplContext>, node?: AzureParentTreeItem | undefined, suppressCreatedWebAppMessage: boolean = false): Promise<WebAppTreeItem | undefined> {
    if (!node) {
        node = <AzureParentTreeItem>await ext.tree.showTreeItemPicker(SubscriptionTreeItem.contextValue, context);
    }
    let newSite: WebAppTreeItem;
    const authErrorRegexp = new RegExp(`The client '.+' with object id '.+' does not have authorization to perform action 'Microsoft\.Web\/serverfarms\/read' over scope '.+' or the scope is invalid\. If access was recently granted, please refresh your credentials\.`);
    try {
        newSite = <WebAppTreeItem>await node.createChild(context);
        if (!suppressCreatedWebAppMessage) {
            showCreatedWebAppMessage(newSite);
        }
        return newSite;
    } catch (error) {
        if (!parseError(error).message.match(authErrorRegexp)) {
            throw error;
        } else {
            const message = localize('notAuthorizedToCreateRGs', 'You subscription is not authorized to create resource groups. Please create using Advanced Create to select existing resource groups.')
            const advancedCreate: MessageItem = { title: localize('createAdvanced', 'Create - Advanced') };
            // don't wait
            void window.showInformationMessage(message, advancedCreate).then(async (result: MessageItem | undefined) => {
                await callWithTelemetryAndErrorHandling('postCreateWebApp', async (context: IActionContext) => {
                    context.telemetry.properties.dialogResult = result?.title;
                    if (result) {
                        newSite = <WebAppTreeItem>await createWebAppAdvanced(context, node);
                        return newSite;
                    }
                });
            });
        }
    }

}

export async function createWebAppAdvanced(context: IActionContext, node?: AzureParentTreeItem | undefined): Promise<WebAppTreeItem | undefined> {
    return await createWebApp({ ...context, advancedCreation: true }, node);
}

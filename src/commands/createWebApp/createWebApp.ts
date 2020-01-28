/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureParentTreeItem, IActionContext, ICreateChildImplContext } from "vscode-azureextensionui";
import { SubscriptionTreeItem } from '../../explorer/SubscriptionTreeItem';
import { WebAppTreeItem } from "../../explorer/WebAppTreeItem";
import { ext } from "../../extensionVariables";

export async function createWebApp(context: IActionContext & Partial<ICreateChildImplContext>, node?: AzureParentTreeItem | undefined): Promise<void> {
    if (!node) {
        node = <AzureParentTreeItem>await ext.tree.showTreeItemPicker(SubscriptionTreeItem.contextValue, context);
    }

    await node.createChild(context);
}

export async function createWebAppAdvanced(context: IActionContext, node?: AzureParentTreeItem | undefined): Promise<void> {
    return await createWebApp({ ...context, advancedCreation: true }, node);
}

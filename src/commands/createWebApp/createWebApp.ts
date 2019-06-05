/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureParentTreeItem, IActionContext } from "vscode-azureextensionui";
import { SubscriptionTreeItem } from '../../explorer/SubscriptionTreeItem';
import { WebAppTreeItem } from "../../explorer/WebAppTreeItem";
import { ext } from "../../extensionVariables";

export async function createWebApp(context: IActionContext, node?: AzureParentTreeItem | undefined): Promise<void> {
    if (!node) {
        node = <AzureParentTreeItem>await ext.tree.showTreeItemPicker(SubscriptionTreeItem.contextValue, context);
    }

    let newSite: WebAppTreeItem | undefined;
    newSite = <WebAppTreeItem>await node.createChild(context);

    newSite.showCreatedOutput(context);
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtParentTreeItem, IActionContext, ICreateChildImplContext } from "@microsoft/vscode-azext-utils";
import { ext } from "../../extensionVariables";
import { SiteTreeItem } from "../../tree/SiteTreeItem";
import { SubscriptionTreeItem } from '../../tree/SubscriptionTreeItem';
import { showCreatedWebAppMessage } from "./showCreatedWebAppMessage";

export async function createWebApp(context: IActionContext & Partial<ICreateChildImplContext>, node?: AzExtParentTreeItem | undefined, suppressCreatedWebAppMessage: boolean = false): Promise<SiteTreeItem> {
    if (!node) {
        node = <AzExtParentTreeItem>await ext.rgApi.tree.showTreeItemPicker(SubscriptionTreeItem.contextValue, context);
    }

    const newSite: SiteTreeItem = <SiteTreeItem>await node.createChild(context);
    if (!suppressCreatedWebAppMessage) {
        showCreatedWebAppMessage(context, newSite);
    }
    return newSite;
}

export async function createWebAppAdvanced(context: IActionContext, node?: AzExtParentTreeItem | undefined): Promise<SiteTreeItem> {
    return await createWebApp({ ...context, advancedCreation: true }, node);
}

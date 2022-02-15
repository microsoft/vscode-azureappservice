/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as appservice from "@microsoft/vscode-azext-azureappservice";
import { DeploymentsTreeItem } from "@microsoft/vscode-azext-azureappservice";
import { IActionContext } from "@microsoft/vscode-azext-utils";
import { ScmType } from "../../constants";
import { ext } from "../../extensionVariables";
import { SiteTreeItem } from "../../tree/SiteTreeItem";
import { WebAppTreeItem } from "../../tree/WebAppTreeItem";

export async function editScmType(context: IActionContext, node?: SiteTreeItem | DeploymentsTreeItem, newScmType?: ScmType, showToast?: boolean): Promise<void> {
    if (!node) {
        node = <SiteTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue, context);
    } else if (node instanceof DeploymentsTreeItem) {
        node = <SiteTreeItem>node.parent;
    }

    if (node.deploymentsNode === undefined) {
        await node.refresh(context);
    }

    await appservice.editScmType(context, node.site, node.subscription, newScmType, showToast);
    await node.deploymentsNode?.refresh(context);
}

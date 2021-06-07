/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as appservice from "vscode-azureappservice";
import { DeploymentsTreeItem } from "vscode-azureappservice";
import { IActionContext } from "vscode-azureextensionui";
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

    await appservice.editScmType(context, node.root.client, node.root, newScmType, showToast);
    await node.deploymentsNode?.refresh(context);
}

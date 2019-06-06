/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DeploymentsTreeItem } from "vscode-azureappservice";
import * as appservice from "vscode-azureappservice";
import { IActionContext } from "vscode-azureextensionui";
import { ScmType } from "../../constants";
import { SiteTreeItem } from "../../explorer/SiteTreeItem";
import { WebAppTreeItem } from "../../explorer/WebAppTreeItem";
import { ext } from "../../extensionVariables";

export async function editScmType(context: IActionContext, node?: SiteTreeItem | DeploymentsTreeItem, newScmType?: ScmType, showToast?: boolean): Promise<void> {
    if (!node) {
        node = <SiteTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue, context);
    } else if (node instanceof DeploymentsTreeItem) {
        node = <SiteTreeItem>node.parent;
    }

    await appservice.editScmType(node.root.client, node, context, newScmType, showToast);

    if (node.deploymentsNode) {
        await node.deploymentsNode.refresh();
    }
}

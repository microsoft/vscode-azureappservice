/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as appservice from "vscode-azureappservice";
import { DeploymentsTreeItem } from "vscode-azureappservice";
import { AzureParentTreeItem, IActionContext } from "vscode-azureextensionui";
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

    if (node instanceof DeploymentsTreeItem && node.parent instanceof AzureParentTreeItem) {
        await appservice.editScmType(context, node.root.client, node.root, newScmType, showToast);
    } else if (node instanceof SiteTreeItem) {
        if (node.deploymentsNode === undefined) {
            await node.refresh();
        }
        await appservice.editScmType(context, node.root.client, node.root, newScmType, showToast);
    }

    if (node.deploymentsNode) {
        await node.deploymentsNode.refresh();
    }
}

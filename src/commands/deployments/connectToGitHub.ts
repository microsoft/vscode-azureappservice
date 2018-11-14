/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DeploymentsTreeItem, editScmType } from "vscode-azureappservice";
import { AzureTreeItem, IActionContext } from "vscode-azureextensionui";
import { ScmType } from "../../constants";
import { SiteTreeItem } from "../../explorer/SiteTreeItem";
import { WebAppTreeItem } from "../../explorer/WebAppTreeItem";
import { ext } from "../../extensionVariables";

export async function connectToGitHub(this: IActionContext, node?: SiteTreeItem | DeploymentsTreeItem): Promise<void> {
    if (!node) {
        node = <SiteTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue);
    }
    await editScmType(node.root.client, node, this, ScmType.GitHub);
    if (node instanceof SiteTreeItem) {
        const children: AzureTreeItem[] = await node.getCachedChildren();
        const deploymentsNode: DeploymentsTreeItem = <DeploymentsTreeItem>children.find((ti: AzureTreeItem) => ti instanceof DeploymentsTreeItem);
        await deploymentsNode.refresh();
    } else {
        await node.parent.refresh();
    }
}

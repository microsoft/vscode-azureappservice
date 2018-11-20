/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DeploymentsTreeItem, editScmType } from "vscode-azureappservice";
import { IActionContext } from "vscode-azureextensionui";
import { ScmType } from "../../constants";
import { SiteTreeItem } from "../../explorer/SiteTreeItem";
import { WebAppTreeItem } from "../../explorer/WebAppTreeItem";
import { ext } from "../../extensionVariables";

export async function connectToGitHub(this: IActionContext, node?: WebAppTreeItem | DeploymentsTreeItem): Promise<void> {
    if (!node) {
        node = <WebAppTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue);
    }
    await editScmType(node.root.client, node, this, ScmType.GitHub);
    if (node instanceof SiteTreeItem) {
        if (node.deploymentsNode) {
            await node.deploymentsNode.refresh();
        }
    } else {
        await node.parent.refresh();
    }
}

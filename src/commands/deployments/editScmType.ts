/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DeploymentsTreeItem } from "vscode-azureappservice";
import * as appservice from "vscode-azureappservice";
import { IActionContext } from "vscode-azureextensionui";
import { SiteTreeItem } from "../../explorer/SiteTreeItem";
import { ext } from "../../extensionVariables";

export async function editScmType(actionContext: IActionContext, node?: SiteTreeItem | DeploymentsTreeItem): Promise<void> {
    if (!node) {
        node = <DeploymentsTreeItem>await ext.tree.showTreeItemPicker([DeploymentsTreeItem.contextValueConnected, DeploymentsTreeItem.contextValueUnconnected]);
    } else if (node instanceof SiteTreeItem) {
        actionContext.properties.contextValue = node.contextValue;
        node = <DeploymentsTreeItem>node.deploymentsNode;
    } else {
        // entered through deployments node context menu
        actionContext.properties.contextValue = node.contextValue;
    }

    await appservice.editScmType(node.root.client, node.parent, actionContext);
    await node.refresh();
}

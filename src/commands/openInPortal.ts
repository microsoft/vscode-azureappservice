/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DeploymentsTreeItem } from "vscode-azureappservice";
import { AzExtParentTreeItem, IActionContext, ISubscriptionContext, openInPortal as uiOpenInPortal } from "vscode-azureextensionui";
import { DeploymentSlotsTreeItem } from "../explorer/DeploymentSlotsTreeItem";
import { WebAppTreeItem } from "../explorer/WebAppTreeItem";
import { ext } from "../extensionVariables";
import { nonNullProp } from "../utils/nonNull";
import { findSubscriptionTreeItem } from '../utils/treeUtils';

export async function openInPortal(context: IActionContext, node?: AzExtParentTreeItem): Promise<void> {
    if (!node) {
        node = await ext.tree.showTreeItemPicker<WebAppTreeItem>(WebAppTreeItem.contextValue, context);
    }

    const root: ISubscriptionContext = findSubscriptionTreeItem(node).root;
    switch (node.contextValue) {
        // the deep link for slots does not follow the conventional pattern of including its parent in the path name so this is how we extract the slot's id
        case DeploymentSlotsTreeItem.contextValue:
            await uiOpenInPortal(root, `${nonNullProp(node, 'parent').fullId}/deploymentSlots`);
            return;
        // the deep link for "Deployments" do not follow the conventional pattern of including its parent in the path name so we need to pass the "Deployment Center" url directly
        case DeploymentsTreeItem.contextValueConnected:
        case DeploymentsTreeItem.contextValueUnconnected:
            await uiOpenInPortal(root, `${nonNullProp(node, 'parent').fullId}/vstscd`);
            return;
        default:
            await uiOpenInPortal(root, node.fullId);
            return;
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DeploymentsTreeItem, DeploymentTreeItem } from "@microsoft/vscode-azext-azureappservice";
import { openInPortal as uiOpenInPortal } from '@microsoft/vscode-azext-azureutils';
import { nonNullValue, type AzExtTreeItem, type IActionContext } from "@microsoft/vscode-azext-utils";
import { DeploymentSlotsTreeItem } from "../tree/DeploymentSlotsTreeItem";
import { matchContextValue } from "../utils/contextUtils";
import { nonNullProp } from "../utils/nonNull";

export async function openInPortal(context: IActionContext, treeItem?: AzExtTreeItem): Promise<void> {
    const node = nonNullValue(treeItem);
    if (matchContextValue(node.contextValue, [DeploymentSlotsTreeItem.contextValue])) {
        // the deep link for slots does not follow the conventional pattern of including its parent in the path name so this is how we extract the slot's id
        await uiOpenInPortal(node, `${nonNullProp(node, 'parent').id}/deploymentSlotsV2`);
        return;
    }

    if (matchContextValue(node.contextValue, [new RegExp(DeploymentsTreeItem.contextValueConnected), new RegExp(DeploymentsTreeItem.contextValueUnconnected)])) {
        // the deep link for "Deployments" do not follow the conventional pattern of including its parent in the path name so we need to pass the "Deployment Center" url directly
        const id = `${nonNullProp(node, 'parent').id}/vstscd`;
        await uiOpenInPortal(node, id);
        return;
    }

    if (matchContextValue(node.contextValue, [new RegExp(DeploymentTreeItem.contextValue)])) {
        await uiOpenInPortal(node, `${nonNullProp(node, 'parent').parent?.id}/Deployments/${nonNullProp(node, 'id')}`);
        return;
    }

    await uiOpenInPortal(node, nonNullProp(node, 'id'));
}

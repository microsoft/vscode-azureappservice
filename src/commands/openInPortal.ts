/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DeploymentsTreeItem } from "@microsoft/vscode-azext-azureappservice";
import { openInPortal as uiOpenInPortal } from '@microsoft/vscode-azext-azureutils';
import { AzExtTreeItem, IActionContext } from "@microsoft/vscode-azext-utils";
import { DeploymentSlotsTreeItem } from "../tree/DeploymentSlotsTreeItem";
import { nonNullProp } from "../utils/nonNull";

export async function openInPortal(context: IActionContext, node: AzExtTreeItem): Promise<void> {
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

    await uiOpenInPortal(node, `${nonNullProp(node, 'parent').parent?.id}/Deployments/${nonNullProp(node, 'id')}`);
}

function matchContextValue(expectedContextValue: RegExp | string, matches: (string | RegExp)[]): boolean {
    if (expectedContextValue instanceof RegExp) {
        return matches.some((match) => {
            if (match instanceof RegExp) {
                return expectedContextValue.toString() === match.toString();
            }
            return expectedContextValue.test(match);
        });
    } else {
        return matches.some((match) => {
            if (match instanceof RegExp) {
                return match.test(expectedContextValue);
            }
            return expectedContextValue === match;
        });
    }
}

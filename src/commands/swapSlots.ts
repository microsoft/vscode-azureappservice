/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as appservice from 'vscode-azureappservice';
import { IActionContext } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { DeploymentSlotTreeItem } from '../tree/DeploymentSlotTreeItem';

export async function swapSlots(context: IActionContext, sourceSlotNode: DeploymentSlotTreeItem | undefined): Promise<void> {
    if (!sourceSlotNode) {
        sourceSlotNode = await ext.tree.showTreeItemPicker<DeploymentSlotTreeItem>(DeploymentSlotTreeItem.contextValue, { ...context, suppressCreatePick: true });
    }

    const existingSlots: DeploymentSlotTreeItem[] = <DeploymentSlotTreeItem[]>await sourceSlotNode.parent.getCachedChildren(context);
    await appservice.swapSlot(context, sourceSlotNode.site, existingSlots.map(s => s.site));
}

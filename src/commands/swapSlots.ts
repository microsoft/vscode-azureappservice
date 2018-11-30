/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as appservice from 'vscode-azureappservice';
import { DeploymentSlotTreeItem } from '../explorer/DeploymentSlotTreeItem';
import { ext } from '../extensionVariables';

export async function swapSlots(sourceSlotNode: DeploymentSlotTreeItem | undefined): Promise<void> {
    if (!sourceSlotNode) {
        sourceSlotNode = <DeploymentSlotTreeItem>await ext.tree.showTreeItemPicker(DeploymentSlotTreeItem.contextValue);
    }

    const existingSlots: DeploymentSlotTreeItem[] = <DeploymentSlotTreeItem[]>await sourceSlotNode.parent.getCachedChildren();
    await appservice.swapSlot(sourceSlotNode, existingSlots);
}

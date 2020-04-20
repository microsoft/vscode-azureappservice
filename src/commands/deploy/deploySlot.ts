/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, openInPortal } from 'vscode-azureextensionui';
import { ScaleUpTreeItem } from '../../explorer/DeploymentSlotsTreeItem';
import { DeploymentSlotTreeItem } from '../../explorer/DeploymentSlotTreeItem';
import { ext } from '../../extensionVariables';
import { deploy } from './deploy';

export async function deploySlot(context: IActionContext, node?: DeploymentSlotTreeItem | ScaleUpTreeItem): Promise<void> {
    if (!node) {
        node = await ext.tree.showTreeItemPicker<DeploymentSlotTreeItem | ScaleUpTreeItem>([DeploymentSlotTreeItem.contextValue, ScaleUpTreeItem.contextValue], context);
    }

    if (node instanceof ScaleUpTreeItem) {
        await openInPortal(node.root, node.scaleUpId);
    } else {
        await deploy(context, node);
    }
}

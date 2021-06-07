/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, openInPortal } from 'vscode-azureextensionui';
import { ext } from '../../extensionVariables';
import { ScaleUpTreeItem } from '../../tree/DeploymentSlotsTreeItem';
import { DeploymentSlotTreeItem } from '../../tree/DeploymentSlotTreeItem';
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

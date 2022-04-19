/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as appservice from '@microsoft/vscode-azext-azureappservice';
import { IActionContext } from '@microsoft/vscode-azext-utils';
import { ext } from '../extensionVariables';
import { ResolvedWebAppResource } from '../tree/ResolvedWebAppResource';
import { SiteTreeItem } from '../tree/SiteTreeItem';

export async function swapSlots(context: IActionContext, sourceSlotNode: SiteTreeItem | undefined): Promise<void> {
    if (!sourceSlotNode) {
        sourceSlotNode = await ext.rgApi.tree.showTreeItemPicker<SiteTreeItem>(ResolvedWebAppResource.slotContextValue, { ...context, suppressCreatePick: true });
    }

    const existingSlots: SiteTreeItem[] = <SiteTreeItem[]>await sourceSlotNode.parent?.getCachedChildren(context);
    await appservice.swapSlot(context, sourceSlotNode.site, existingSlots.map(s => s.site));
}

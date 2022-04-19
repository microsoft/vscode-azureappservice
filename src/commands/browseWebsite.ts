/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from '@microsoft/vscode-azext-utils';
import { ext } from '../extensionVariables';
import { ISiteTreeItem } from '../tree/ISiteTreeItem';
import { ResolvedWebAppResource } from '../tree/ResolvedWebAppResource';
import { SiteTreeItem } from '../tree/SiteTreeItem';

export async function browseWebsite(context: IActionContext, node?: ISiteTreeItem): Promise<void> {
    if (!node) {
        node = await ext.rgApi.tree.showTreeItemPicker<SiteTreeItem>(new RegExp(ResolvedWebAppResource.webAppContextValue), context);
    }

    await node.browse();
}

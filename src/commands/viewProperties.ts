/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, openReadOnlyJson } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { SiteTreeItem } from '../tree/SiteTreeItem';
import { WebAppTreeItem } from '../tree/WebAppTreeItem';

export async function viewProperties(context: IActionContext, node?: SiteTreeItem): Promise<void> {
    if (!node) {
        node = await ext.tree.showTreeItemPicker<WebAppTreeItem>(WebAppTreeItem.contextValue, context);
    }

    await node.runWithTemporaryDescription(context, localize('retrievingProps', 'Retrieving properties...'), async () => {
        // `siteConfig` already exists on `node.site`, but has very limited properties for some reason. We want to get the full site config
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        node!.site.siteConfig = await node!.root.client.getSiteConfig();
    });

    await openReadOnlyJson(node, node.site);
}

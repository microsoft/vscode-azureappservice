/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from "vscode-azureextensionui";
import { SiteTreeItem } from "../explorer/SiteTreeItem";
import { WebAppTreeItem } from "../explorer/WebAppTreeItem";
import { ext } from "../extensionVariables";
import { openUrl } from "../utils/openUrl";

export async function browseWebsite(context: IActionContext, node?: SiteTreeItem): Promise<void> {
    if (!node) {
        node = await ext.tree.showTreeItemPicker<WebAppTreeItem>(WebAppTreeItem.contextValue, context);
    }

    await openUrl(node.root.client.defaultHostUrl);
}

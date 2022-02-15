/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from "@microsoft/vscode-azext-utils";
import { commands } from "vscode";
import { ext } from "../extensionVariables";
import { SiteTreeItem } from "../tree/SiteTreeItem";
import { WebAppTreeItem } from "../tree/WebAppTreeItem";

export async function restartWebApp(context: IActionContext, node?: SiteTreeItem): Promise<void> {
    if (!node) {
        node = await ext.tree.showTreeItemPicker<WebAppTreeItem>(WebAppTreeItem.contextValue, context);
    }
    await commands.executeCommand('appService.Stop', node);
    await commands.executeCommand('appService.Start', node);
}

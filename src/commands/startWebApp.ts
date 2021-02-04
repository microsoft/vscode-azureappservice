/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteClient } from "vscode-azureappservice";
import { IActionContext } from "vscode-azureextensionui";
import { SiteTreeItem } from "../explorer/SiteTreeItem";
import { WebAppTreeItem } from "../explorer/WebAppTreeItem";
import { ext } from "../extensionVariables";
import { localize } from "../localize";

export async function startWebApp(context: IActionContext, node?: SiteTreeItem): Promise<void> {
    if (!node) {
        node = await ext.tree.showTreeItemPicker<WebAppTreeItem>(WebAppTreeItem.contextValue, context);
    }

    const client: SiteClient = node.root.client;
    const startingApp: string = localize('startingApp', 'Starting "{0}"...', client.fullName);
    const startedApp: string = localize('startedApp', '"{0}" has been started.', client.fullName);

    await node.runWithTemporaryDescription(context, localize('starting', "Starting..."), async () => {
        ext.outputChannel.appendLog(startingApp);
        await client.start();
        ext.outputChannel.appendLog(startedApp);
    });
}

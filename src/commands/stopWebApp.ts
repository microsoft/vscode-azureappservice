
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteClient } from "vscode-azureappservice";
import { IActionContext } from "vscode-azureextensionui";
import { SiteTreeItem } from "../explorer/SiteTreeItem";
import { WebAppTreeItem } from "../explorer/WebAppTreeItem";
import { ext } from "../extensionVariables";

export async function stopWebApp(context: IActionContext, node?: SiteTreeItem): Promise<void> {
    if (!node) {
        node = await ext.tree.showTreeItemPicker<WebAppTreeItem>(WebAppTreeItem.contextValue, context);
    }

    const client: SiteClient = node.root.client;
    const stoppingApp: string = `Stopping "${client.fullName}"...`;
    const stoppedApp: string = `"${client.fullName}" has been stopped. App Service plan charges still apply.`;
    await node.runWithTemporaryDescription("Stopping...", async () => {
        ext.outputChannel.appendLog(stoppingApp);
        await client.stop();
        ext.outputChannel.appendLog(stoppedApp);
    });
}

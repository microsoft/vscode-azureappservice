
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteClient } from "vscode-azureappservice";
import { IActionContext } from "vscode-azureextensionui";
import { ext } from "../extensionVariables";
import { localize } from "../localize";
import { SiteTreeItem } from "../tree/SiteTreeItem";
import { WebAppTreeItem } from "../tree/WebAppTreeItem";

export async function stopWebApp(context: IActionContext, node?: SiteTreeItem): Promise<void> {
    if (!node) {
        node = await ext.tree.showTreeItemPicker<WebAppTreeItem>(WebAppTreeItem.contextValue, context);
    }

    const client: SiteClient = node.root.client;
    const stoppingApp: string = localize('stoppingApp', 'Stopping "{0}"...', client.fullName);
    const stoppedApp: string = localize('stoppedApp', '"{0}" has been stopped. App Service plan charges still apply.', client.fullName);
    await node.runWithTemporaryDescription(context, localize('stopping', "Stopping..."), async () => {
        ext.outputChannel.appendLog(stoppingApp);
        await client.stop();
        ext.outputChannel.appendLog(stoppedApp);
    });
}


/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type IActionContext } from "@microsoft/vscode-azext-utils";
import { ext } from "../extensionVariables";
import { localize } from "../localize";
import { type SiteTreeItem } from "../tree/SiteTreeItem";
import { pickWebApp } from "../utils/pickWebApp";

export async function stopWebApp(context: IActionContext, node?: SiteTreeItem): Promise<void> {
    if (!node) {
        node = await pickWebApp(context);
    }

    await node.initSite(context);
    const client = await node.site.createClient(context);
    const stoppingApp: string = localize('stoppingApp', 'Stopping "{0}"...', node.site.fullName);
    const stoppedApp: string = localize('stoppedApp', '"{0}" has been stopped. App Service plan charges still apply.', node.site.fullName);
    await node.runWithTemporaryDescription(context, localize('stopping', "Stopping..."), async () => {
        ext.outputChannel.appendLog(stoppingApp);
        await client.stop();
        ext.outputChannel.appendLog(stoppedApp);
    });
}

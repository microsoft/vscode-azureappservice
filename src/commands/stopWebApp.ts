/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DialogResponses, type IActionContext } from "@microsoft/vscode-azext-utils";
import { ext } from "../extensionVariables";
import { localize } from "../localize";
import { type SiteTreeItem } from "../tree/SiteTreeItem";
import { pickWebApp } from "../utils/pickWebApp";

export async function stopWebApp(context: IActionContext, node?: SiteTreeItem): Promise<void> {
    if (!node) {
        node = await pickWebApp(context);
    }

    await node.initSite(context);

    if (!node.site.isSlot) {
        const confirmMessage: string = localize('confirmStop', 'Stop web app "{0}"? Traffic will be interrupted.', node.site.fullName);
        await context.ui.showWarningMessage(confirmMessage, { modal: true, stepName: 'confirmStop' }, DialogResponses.yes, DialogResponses.cancel);
    }

    const client = await node.site.createClient(context);
    const stoppingApp: string = localize('stoppingApp', 'Stopping "{0}"...', node.site.fullName);
    const stoppedApp: string = localize('stoppedApp', '"{0}" has been stopped. App Service plan charges still apply.', node.site.fullName);
    await node.runWithTemporaryDescription(context, localize('stopping', "Stopping..."), async () => {
        ext.outputChannel.appendLog(stoppingApp);
        await client.stop();
        ext.outputChannel.appendLog(stoppedApp);
    });
}

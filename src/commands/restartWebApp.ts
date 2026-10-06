/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DialogResponses, type IActionContext } from "@microsoft/vscode-azext-utils";
import { ext } from "../extensionVariables";
import { localize } from "../localize";
import { type SiteTreeItem } from "../tree/SiteTreeItem";
import { pickWebApp } from "../utils/pickWebApp";

export async function restartWebApp(context: IActionContext, node?: SiteTreeItem): Promise<void> {
    node ??= await pickWebApp(context);
    await node.initSite(context);

    if (!node.site.isSlot) {
        const confirmMessage: string = localize('confirmRestart', 'Restart web app "{0}"? Traffic will be interrupted.', node.site.fullName);
        await context.ui.showWarningMessage(confirmMessage, { modal: true, stepName: 'confirmRestart' }, DialogResponses.yes, DialogResponses.cancel);
    }

    const client = await node.site.createClient(context);
    const restartingApp: string = localize('restartingApp', 'Restarting "{0}"...', node.site.fullName);
    const restartedApp: string = localize('restartedApp', '"{0}" has been restarted.', node.site.fullName);
    await node.runWithTemporaryDescription(context, localize('restarting', "Restarting..."), async () => {
        ext.outputChannel.appendLog(restartingApp);
        await client.stop();
        await client.start();
        ext.outputChannel.appendLog(restartedApp);
    });
}

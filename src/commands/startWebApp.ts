/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from "@microsoft/vscode-azext-utils";
import { ext } from "../extensionVariables";
import { localize } from "../localize";
import { ResolvedWebAppResource } from "../tree/ResolvedWebAppResource";
import { SiteTreeItem } from "../tree/SiteTreeItem";

export async function startWebApp(context: IActionContext, node?: SiteTreeItem): Promise<void> {
    if (!node) {
        node = await ext.rgApi.tree.showTreeItemPicker<SiteTreeItem>(new RegExp(ResolvedWebAppResource.webAppContextValue), context);
    }

    const startingApp: string = localize('startingApp', 'Starting "{0}"...', node.site.fullName);
    const startedApp: string = localize('startedApp', '"{0}" has been started.', node.site.fullName);

    const client = await node.site.createClient(context);
    await node.runWithTemporaryDescription(context, localize('starting', "Starting..."), async () => {
        ext.outputChannel.appendLog(startingApp);
        await client.start();
        ext.outputChannel.appendLog(startedApp);
    });
}

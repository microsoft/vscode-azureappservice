/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type WebSiteManagementClient } from "@azure/arm-appservice";
import { type IActionContext } from "@microsoft/vscode-azext-utils";
import { ext } from "../extensionVariables";
import { localize } from "../localize";
import { type SiteTreeItem } from "../tree/SiteTreeItem";
import { createWebSiteClient } from "../utils/azureClients";
import { pickWebApp } from "../utils/pickWebApp";

export async function restartWebApp(context: IActionContext, node?: SiteTreeItem): Promise<void> {
    node ??= await pickWebApp(context);

    await node.initSite(context);
    const site = node.site;
    const client: WebSiteManagementClient = await createWebSiteClient([context, node.subscription]);
    const restartingApp: string = localize('restartingApp', 'Restarting "{0}"...', site.fullName);
    const restartedApp: string = localize('restartedApp', '"{0}" has been restarted.', site.fullName);
    await node.runWithTemporaryDescription(context, localize('restarting', "Restarting..."), async () => {
        ext.outputChannel.appendLog(restartingApp);
        if (site.slotName) {
            await client.webApps.restartSlot(site.resourceGroup, site.siteName, site.slotName);
        } else {
            await client.webApps.restart(site.resourceGroup, site.siteName);
        }
        ext.outputChannel.appendLog(restartedApp);
    });
}

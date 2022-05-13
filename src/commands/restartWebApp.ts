/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from "@microsoft/vscode-azext-utils";
import { commands } from "vscode";
import { webAppFilter } from "../constants";
import { ext } from "../extensionVariables";
import { ResolvedWebAppResource } from "../tree/ResolvedWebAppResource";
import { SiteTreeItem } from "../tree/SiteTreeItem";

export async function restartWebApp(context: IActionContext, node?: SiteTreeItem): Promise<void> {
    if (!node) {
        node = await ext.rgApi.pickAppResource<SiteTreeItem>(context, {
            filter: webAppFilter,
            expectedChildContextValue: new RegExp(ResolvedWebAppResource.webAppContextValue)
        });
    }
    await commands.executeCommand('appService.Stop', node);
    await commands.executeCommand('appService.Start', node);
}

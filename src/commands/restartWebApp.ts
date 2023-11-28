/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type IActionContext } from "@microsoft/vscode-azext-utils";
import { commands } from "vscode";
import { type SiteTreeItem } from "../tree/SiteTreeItem";
import { pickWebApp } from "../utils/pickWebApp";

export async function restartWebApp(context: IActionContext, node?: SiteTreeItem): Promise<void> {
    node ??= await pickWebApp(context);
    await commands.executeCommand('appService.Stop', node);
    await commands.executeCommand('appService.Start', node);
}

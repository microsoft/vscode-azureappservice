/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { CancellationTokenSource } from "vscode";
import { IActionContext } from "vscode-azureextensionui";
import { SiteTreeItem } from "../../tree/SiteTreeItem";
import { checkLinuxWebAppDownDetector } from "./checkLinuxWebAppDownDetector";
import { validateWebSite } from "./validateWebSite";

export function runPostDeployTask(context: IActionContext, node: SiteTreeItem, correlationId: string, tokenSource: CancellationTokenSource): void {
    // both of these should be happening in parallel so don't await either

    void validateWebSite(context, correlationId, node, tokenSource);

    // this currently only works for Linux apps
    if (node.root.client.isLinux) {
        void checkLinuxWebAppDownDetector(context, correlationId, node, tokenSource);
    }
}

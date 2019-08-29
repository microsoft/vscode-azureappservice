/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { CancellationTokenSource } from "vscode";
import { SiteTreeItem } from "../../explorer/SiteTreeItem";
import { checkLinuxWebAppDownDetector } from "./checkLinuxWebAppDownDetector";
import { validateWebSite } from "./validateWebSite";

export async function runPostDeployTask(node: SiteTreeItem, correlationId: string, tokenSource: CancellationTokenSource): Promise<void> {
    await validateWebSite(correlationId, node).then(
        async () => {
            // ignore
        },
        async () => {
            // ignore
        });

    // this currently only works for Linux apps, so ignore if it's Windows
    if (!node.root.client.isLinux) {
        await checkLinuxWebAppDownDetector(correlationId, node, tokenSource);
    }
}

/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { CancellationTokenSource } from "vscode";
import { SiteTreeItem } from "../../explorer/SiteTreeItem";
import { checkLinuxWebAppDownDetector } from "./checkLinuxWebAppDownDetector";
import { validateWebSite } from "./validateWebSite";

export async function runPostDeployTask(node: SiteTreeItem, correlationId: string, tokenSource: CancellationTokenSource): Promise<void> {
    // both of these should be happening in parallel so don't await either

    // tslint:disable-next-line: no-floating-promises
    validateWebSite(correlationId, node, tokenSource);

    // this currently only works for Linux apps
    if (node.root.client.isLinux) {
        // tslint:disable-next-line: no-floating-promises
        checkLinuxWebAppDownDetector(correlationId, node, tokenSource);
    }
}

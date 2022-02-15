/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ParsedSite } from "@microsoft/vscode-azext-azureappservice";
import { callWithTelemetryAndErrorHandling, IActionContext } from "@microsoft/vscode-azext-utils";
import { MessageItem, window } from "vscode";
import { AppServiceDialogResponses } from "../../constants";
import { ext } from "../../extensionVariables";
import { localize } from "../../localize";
import { SiteTreeItem } from "../../tree/SiteTreeItem";
import { deploy } from '../deploy/deploy';

export function showCreatedWebAppMessage(originalContext: IActionContext, node: SiteTreeItem): void {
    const message: string = getCreatedWebAppMessage(node.site);

    // don't wait
    void window.showInformationMessage(message, AppServiceDialogResponses.deploy, AppServiceDialogResponses.viewOutput).then(async (result: MessageItem | undefined) => {
        await callWithTelemetryAndErrorHandling('postCreateWebApp', async (context: IActionContext) => {
            context.valuesToMask.push(...originalContext.valuesToMask);
            context.telemetry.properties.dialogResult = result?.title;

            if (result === AppServiceDialogResponses.viewOutput) {
                ext.outputChannel.show();
            } else if (result === AppServiceDialogResponses.deploy) {
                await deploy(context, node, [], true);
            }
        });
    });
}

export function getCreatedWebAppMessage(site: ParsedSite): string {
    return site.isSlot ?
        localize('createdSlot', 'Created new slot "{0}": {1}', site.slotName, site.defaultHostUrl) :
        localize('createdWebApp', 'Created new web app "{0}": {1}', site.fullName, site.defaultHostUrl);
}

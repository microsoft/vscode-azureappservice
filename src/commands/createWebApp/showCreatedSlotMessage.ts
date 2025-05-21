/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type ParsedSite } from "@microsoft/vscode-azext-azureappservice";
import { callWithTelemetryAndErrorHandling, type IActionContext } from "@microsoft/vscode-azext-utils";
import { window, type MessageItem } from "vscode";
import { AppServiceDialogResponses } from "../../constants";
import { ext } from "../../extensionVariables";
import { localize } from "../../localize";
import { type SiteTreeItem } from "../../tree/SiteTreeItem";
import { deploy } from '../deploy/deploy';

export function showCreatedSlotMessage(originalContext: IActionContext, node: SiteTreeItem): void {
    const message: string = getCreatedSlotMessage(node.site);

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

export function getCreatedSlotMessage(site: ParsedSite): string {
    return localize('createdSlot', 'Created new slot "{0}": {1}', site.slotName, site.defaultHostUrl)
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageItem, window } from "vscode";
import { SiteClient } from "vscode-azureappservice";
import { callWithTelemetryAndErrorHandling, IActionContext } from "vscode-azureextensionui";
import { AppServiceDialogResponses } from "../../constants";
import { SiteTreeItem } from "../../explorer/SiteTreeItem";
import { ext } from "../../extensionVariables";
import { localize } from "../../localize";
import { deploy } from '../deploy/deploy';

export function showCreatedWebAppMessage(node: SiteTreeItem): void {
    const message: string = getCreatedWebAppMessage(node.root.client);

    // don't wait
    window.showInformationMessage(message, AppServiceDialogResponses.deploy, AppServiceDialogResponses.viewOutput).then(async (result: MessageItem | undefined) => {
        await callWithTelemetryAndErrorHandling('postCreateWebApp', async (context: IActionContext) => {
            context.telemetry.properties.dialogResult = result?.title;
            if (result === AppServiceDialogResponses.viewOutput) {
                ext.outputChannel.show();
            } else if (result === AppServiceDialogResponses.deploy) {
                await deploy(context, node, [], true);
            }
        });
    });
}

export function getCreatedWebAppMessage(client: SiteClient): string {
    return client.isSlot ?
        localize('createdSlot', 'Created new slot "{0}": {1}', client.slotName, client.defaultHostUrl) :
        localize('createdWebApp', 'Created new web app "{0}": {1}', client.fullName, client.defaultHostUrl);
}

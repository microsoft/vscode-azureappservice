/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageItem, window } from "vscode";
import { callWithTelemetryAndErrorHandling, IActionContext } from "vscode-azureextensionui";
import { AppServiceDialogResponses } from "../../constants";
import { SiteTreeItem } from "../../explorer/SiteTreeItem";
import { ext } from "../../extensionVariables";
import { localize } from "../../localize";
import { startStreamingLogs } from '../logstream/startStreamingLogs';

export function showDeployCompletedMessage(node: SiteTreeItem): void {
    const message: string = localize('deployCompleted', 'Deployment to "{0}" completed.', node.client.fullName);
    ext.outputChannel.appendLog(message);
    const browseWebsiteBtn: MessageItem = { title: localize('browseWebsite', 'Browse Website') };
    const streamLogs: MessageItem = { title: localize('streamLogs', 'Stream Logs') };

    // don't wait
    void window.showInformationMessage(message, browseWebsiteBtn, streamLogs, AppServiceDialogResponses.viewOutput).then(async (result: MessageItem | undefined) => {
        await callWithTelemetryAndErrorHandling('postDeploy', async (context: IActionContext) => {
            context.telemetry.properties.dialogResult = result?.title;
            if (result === AppServiceDialogResponses.viewOutput) {
                ext.outputChannel.show();
            } else if (result === browseWebsiteBtn) {
                await node.browse();
            } else if (result === streamLogs) {
                await startStreamingLogs(context, node);
            }
        });
    });
}

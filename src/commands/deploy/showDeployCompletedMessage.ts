/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageItem, window } from "vscode";
import { callWithTelemetryAndErrorHandling, IActionContext } from "vscode-azureextensionui";
import { AppServiceDialogResponses } from "../../constants";
import { ext } from "../../extensionVariables";
import { localize } from "../../localize";
import { SiteTreeItem } from "../../tree/SiteTreeItem";
import { uploadAppSettings } from "../appSettings/uploadAppSettings";
import { startStreamingLogs } from '../logstream/startStreamingLogs';

export function showDeployCompletedMessage(originalContext: IActionContext, node: SiteTreeItem): void {
    const message: string = localize('deployCompleted', 'Deployment to "{0}" completed.', node.site.fullName);
    ext.outputChannel.appendLog(message);
    const browseWebsiteBtn: MessageItem = { title: localize('browseWebsite', 'Browse Website') };
    const streamLogs: MessageItem = { title: localize('streamLogs', 'Stream Logs') };
    const uploadSettingsBtn: MessageItem = { title: localize('uploadMessage', 'Upload Settings') };
    const buttons: MessageItem[] = [browseWebsiteBtn, streamLogs, uploadSettingsBtn];


    // don't wait
    void window.showInformationMessage(message, ...buttons).then(async (result: MessageItem | undefined) => {
        await callWithTelemetryAndErrorHandling('postDeploy', async (context: IActionContext) => {
            context.valuesToMask.push(...originalContext.valuesToMask);
            context.telemetry.properties.dialogResult = result?.title;
            context.telemetry.eventVersion = 2;

            if (result === AppServiceDialogResponses.viewOutput) {
                ext.outputChannel.show();
            } else if (result === browseWebsiteBtn) {
                await node.browse();
            } else if (result === streamLogs) {
                await startStreamingLogs(context, node);
            } else if (result === uploadSettingsBtn) {
                await uploadAppSettings(context, node.appSettingsNode);
            }
        });
    });
}

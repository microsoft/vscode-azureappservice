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
import * as workspaceUtil from '../../utils/workspace';
import { uploadAppSettings } from "../appSettings/uploadAppSettings";
import { startStreamingLogs } from '../logstream/startStreamingLogs';

export async function showDeployCompletedMessage(node: SiteTreeItem): Promise<void> {
    const message: string = localize('deployCompleted', 'Deployment to "{0}" completed.', node.client.fullName);
    ext.outputChannel.appendLog(message);
    const browseWebsiteBtn: MessageItem = { title: localize('browseWebsite', 'Browse Website') };
    const streamLogs: MessageItem = { title: localize('streamLogs', 'Stream Logs') };
    const uploadSettingsBtn: MessageItem = { title: localize('uploadMessage', 'Upload Local Settings') };

    const filesByFileExt = await workspaceUtil.findFilesByFileExtension(undefined, "env");
    let envPath: string;
    if (filesByFileExt && filesByFileExt.length > 0) {
        if (filesByFileExt.length <= 1) {
            envPath = filesByFileExt[0].fsPath;
        }
        // don't wait
        await window.showInformationMessage(message, browseWebsiteBtn, streamLogs, uploadSettingsBtn).then(async (result: MessageItem | undefined) => {
            await callWithTelemetryAndErrorHandling('postDeploy', async (context: IActionContext) => {
                context.telemetry.properties.dialogResult = result?.title;
                if (result === AppServiceDialogResponses.viewOutput) {
                    ext.outputChannel.show();
                } else if (result === browseWebsiteBtn) {
                    await node.browse();
                } else if (result === streamLogs) {
                    await startStreamingLogs(context, node);
                } else if (result === uploadSettingsBtn) {
                    await uploadAppSettings(context, undefined, envPath);
                }
            });
        });
    } else {
        // don't wait
        await window.showInformationMessage(message, browseWebsiteBtn, streamLogs).then(async (result: MessageItem | undefined) => {
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
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteConfigResource } from 'azure-arm-website/lib/models';
import * as opn from 'opn';
import * as vscode from 'vscode';
import { SiteClient } from 'vscode-azureappservice';
import { callWithTelemetryAndErrorHandling, DialogResponses, IActionContext } from 'vscode-azureextensionui';
import { ext } from '../../extensionVariables';

export function reportMessage(message: string, progress: vscode.Progress<{}>): void {
    ext.outputChannel.appendLine(message);
    progress.report({ message: message });
}

export function checkForRemoteDebugSupport(siteConfig: SiteConfigResource): void {
    // So far only node on linux is supported
    if (siteConfig.linuxFxVersion && !siteConfig.linuxFxVersion.toLowerCase().startsWith('node')) {
        throw new Error('Azure Remote Debugging is currently only supported for node on Linux.');
    }
}

export async function setRemoteDebug(isRemoteDebuggingToBeEnabled: boolean, confirmMessage: string, noopMessage: string | undefined, siteClient: SiteClient, siteConfig: SiteConfigResource, progress: vscode.Progress<{}>): Promise<void> {
    if (isRemoteDebuggingToBeEnabled !== siteConfig.remoteDebuggingEnabled) {
        const result: vscode.MessageItem = await ext.ui.showWarningMessage(confirmMessage, { modal: true }, DialogResponses.yes, DialogResponses.learnMore, DialogResponses.cancel);
        if (result === DialogResponses.yes) {
            siteConfig.remoteDebuggingEnabled = isRemoteDebuggingToBeEnabled;

            reportMessage('Updating site configuration to set remote debugging...', progress);
            await callWithTelemetryAndErrorHandling('diagnostics.remoteDebugUpdateConfiguration', ext.reporter, ext.outputChannel, async function (this: IActionContext): Promise<void> {
                this.suppressErrorDisplay = true;
                this.rethrowError = true;
                await siteClient.updateConfiguration(siteConfig);
            });
            reportMessage('Updating site configuration done...', progress);
        } else if (result === DialogResponses.learnMore) {
            // tslint:disable-next-line:no-unsafe-any
            opn('https://aka.ms/appsvc-remotedebug');
        } else {
            // User canceled
            return;
        }
    } else {
        // Update not needed
        if (noopMessage) {
            vscode.window.showWarningMessage(noopMessage);
        }
    }
}

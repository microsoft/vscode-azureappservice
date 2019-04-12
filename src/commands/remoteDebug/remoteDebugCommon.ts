/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteConfigResource } from 'azure-arm-website/lib/models';
import * as vscode from 'vscode';
import { SiteClient } from 'vscode-azureappservice';
import { callWithTelemetryAndErrorHandling, DialogResponses, IActionContext } from 'vscode-azureextensionui';
import { ext } from '../../extensionVariables';

export const remoteDebugLink: string = 'https://aka.ms/appsvc-remotedebug';
export function reportMessage(message: string, progress: vscode.Progress<{}>): void {
    ext.outputChannel.appendLine(message);
    progress.report({ message: message });
}

export function checkForRemoteDebugSupport(siteConfig: SiteConfigResource, actionContext: IActionContext): void {
    // We read siteConfig.linuxFxVersion to find the image version:
    //   If the app is running Windows, it will be empty
    //   If the app is running a blessed Linux image, it will contain the language and version, e.g. "NODE|8.11"
    //   If the app is running a custom Docker image, it will contain the Docker registry information, e.g. "DOCKER|repo.azurecr.io/image:tag"

    if (siteConfig.linuxFxVersion) {
        let version = siteConfig.linuxFxVersion.toLowerCase();

        // Docker images will contain registry information that shouldn't be included in telemetry, so remove that information
        if (version.startsWith('docker')) {
            version = 'docker';
        }

        // Add the version to telemtry for this action
        actionContext.properties.linuxFxVersion = version;

        if (version.startsWith('node')) {
            const splitVersion = version.split('|');
            if (splitVersion.length > 1 && isNodeVersionSupported(splitVersion[1])) {
                // Node version is supported, so return successfully
                return;
            }
        }
    }

    throw new Error('Azure Remote Debugging is currently only supported for Node.js version >= 8.11 on Linux.');
}

// Remote debugging is currently only supported for Node.js >= 8.11
function isNodeVersionSupported(nodeVersion: string): boolean {
    const splitNodeVersion = nodeVersion.split('.');
    if (splitNodeVersion.length < 2) {
        return false;
    }

    const major = +splitNodeVersion[0];
    const minor = +splitNodeVersion[1];

    return (major > 8 || (major === 8 && minor >= 11));
}

export async function setRemoteDebug(isRemoteDebuggingToBeEnabled: boolean, confirmMessage: string, noopMessage: string | undefined, siteClient: SiteClient, siteConfig: SiteConfigResource, progress?: vscode.Progress<{}>, learnMoreLink?: string): Promise<void> {
    if (isRemoteDebuggingToBeEnabled !== siteConfig.remoteDebuggingEnabled) {
        const confirmButton: vscode.MessageItem = isRemoteDebuggingToBeEnabled ? { title: 'Enable' } : { title: 'Disable' };

        // don't have to check input as this handles cancels and learnMore responses
        await ext.ui.showWarningMessage(confirmMessage, { modal: true, learnMoreLink }, confirmButton, DialogResponses.cancel);
        siteConfig.remoteDebuggingEnabled = isRemoteDebuggingToBeEnabled;
        if (progress) {
            reportMessage('Updating site configuration to set remote debugging...', progress);
        }

        await callWithTelemetryAndErrorHandling('appService.remoteDebugUpdateConfiguration', async function (this: IActionContext): Promise<void> {
            this.suppressErrorDisplay = true;
            this.rethrowError = true;
            await siteClient.updateConfiguration(siteConfig);
        });

        if (progress) {
            reportMessage('Updating site configuration done...', progress);
        }
    } else {
        // Update not needed
        if (noopMessage) {
            vscode.window.showWarningMessage(noopMessage);
        }
    }
}

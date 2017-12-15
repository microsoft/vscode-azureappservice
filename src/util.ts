/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import WebSiteManagementClient = require('azure-arm-website');
import * as WebSiteModels from 'azure-arm-website/lib/models';
import * as vscode from 'vscode';
import { UserCancelledError } from 'vscode-azureextensionui';
import { reporter } from './telemetry/reporter';

// Web app & deployment slots
export function isSiteDeploymentSlot(site: WebSiteModels.Site): boolean {
    return site.type.toLowerCase() === 'microsoft.web/sites/slots';
}

export function extractSiteName(site: WebSiteModels.Site): string {
    return isSiteDeploymentSlot(site) ? site.name.substring(0, site.name.lastIndexOf('/')) : site.name;
}

export function extractSiteScmSubDomainName(site: WebSiteModels.Site): string {
    return extractSiteName(site) + (isSiteDeploymentSlot(site) ? `-${extractDeploymentSlotName(site)}` : '');
}

export function extractDeploymentSlotName(site: WebSiteModels.Site): string | undefined {
    return isSiteDeploymentSlot(site) ? site.name.substring(site.name.lastIndexOf('/') + 1) : undefined;
}

export function getWebAppPublishCredential(webSiteManagementClient: WebSiteManagementClient, site: WebSiteModels.Site): Promise<WebSiteModels.User> {
    const webApps = webSiteManagementClient.webApps;
    const siteName = extractSiteName(site);
    const slotName = extractDeploymentSlotName(site);
    return isSiteDeploymentSlot(site) ? webApps.listPublishingCredentialsSlot(site.resourceGroup, siteName, slotName) : webApps.listPublishingCredentials(site.resourceGroup, siteName);
}

// Output channel for the extension
const outputChannel = vscode.window.createOutputChannel("Azure App Service");

export function getOutputChannel(): vscode.OutputChannel {
    return outputChannel;
}

// Telemetry for the extension
export function sendTelemetry(eventName: string, properties?: { [key: string]: string; }, measures?: { [key: string]: number; }): void {
    if (reporter) {
        reporter.sendTelemetryEvent(eventName, properties, measures);
    }
}

// Resource ID
export function parseAzureResourceId(resourceId: string): { [key: string]: string } {
    const invalidIdErr = new Error('Invalid web app ID.');
    const result = {};

    if (!resourceId || resourceId.length < 2 || resourceId.charAt(0) !== '/') {
        throw invalidIdErr;
    }

    const parts = resourceId.substring(1).split('/');

    if (parts.length % 2 !== 0) {
        throw invalidIdErr;
    }

    for (let i = 0; i < parts.length; i += 2) {
        const key = parts[i];
        const value = parts[i + 1];

        if (key === '' || value === '') {
            throw invalidIdErr;
        }

        result[key] = value;
    }

    return result;
}

export async function showWorkspaceFoldersQuickPick(placeHolderString: string): Promise<vscode.WorkspaceFolder> {
    const folderQuickPickItems = vscode.workspace.workspaceFolders ?
        vscode.workspace.workspaceFolders.map((value) => {
            {
                return <IQuickPickItemWithData<vscode.WorkspaceFolder>>{
                    label: value.name,
                    description: value.uri.fsPath,
                    data: value
                };
            }
        }) :
        [];
    // VS Code will handle [] by alerting user there are no workspaces opened

    const folderQuickPickOption = { placeHolder: placeHolderString };
    const pickedItem = folderQuickPickItems.length === 1 ?
        folderQuickPickItems[0] : await vscode.window.showQuickPick(folderQuickPickItems, folderQuickPickOption);

    if (!pickedItem) {
        throw new UserCancelledError();
    }

    return pickedItem.data;
}

export interface IQuickPickItemWithData<T> extends vscode.QuickPickItem {
    persistenceId?: string; // A unique key to identify this item items across sessions, used in persisting previous selections
    data?: T;
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import WebSiteManagementClient = require('azure-arm-website');
import * as WebSiteModels from 'azure-arm-website/lib/models';
import * as vscode from 'vscode';
import { UserCancelledError } from 'vscode-azureextensionui';

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

export async function getWebAppPublishCredential(webSiteManagementClient: WebSiteManagementClient, site: WebSiteModels.Site): Promise<WebSiteModels.User> {
    const webApps = webSiteManagementClient.webApps;
    const siteName = extractSiteName(site);
    const slotName = extractDeploymentSlotName(site);
    return isSiteDeploymentSlot(site) ? await webApps.listPublishingCredentialsSlot(site.resourceGroup, siteName, slotName) : await webApps.listPublishingCredentials(site.resourceGroup, siteName);
}

// Output channel for the extension
const outputChannel = vscode.window.createOutputChannel("Azure App Service");

export function getOutputChannel(): vscode.OutputChannel {
    return outputChannel;
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

export async function showWorkspaceFoldersQuickPick(placeHolderString: string): Promise<string> {
    const browse: IQuickPickItemWithData<vscode.WorkspaceFolder> = { label: '$(file-directory) Browse...', description: '', data: undefined };
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
    folderQuickPickItems.unshift(browse);

    const folderQuickPickOption = { placeHolder: placeHolderString };
    const pickedItem = await vscode.window.showQuickPick(folderQuickPickItems, folderQuickPickOption);

    if (!pickedItem) {
        throw new UserCancelledError();
    }

    if (pickedItem === browse) {
        const browseResult = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : undefined
        });

        if (!browseResult) {
            throw new UserCancelledError();
        }

        return browseResult[0].fsPath;
    }

    return pickedItem.data.uri.fsPath;
}

export interface IQuickPickItemWithData<T> extends vscode.QuickPickItem {
    persistenceId?: string; // A unique key to identify this item items across sessions, used in persisting previous selections
    data?: T;
}

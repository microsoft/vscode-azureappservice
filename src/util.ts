/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { reporter } from './telemetry/reporter';
import WebSiteManagementClient = require('azure-arm-website');
import * as vscode from 'vscode';
import * as WebSiteModels from '../node_modules/azure-arm-website/lib/models';
import { UserCancelledError } from './errors';


export interface PartialList<T> extends Array<T> {
    nextLink?: string;
}

export async function listAll<T>(client: { listNext(nextPageLink: string): Promise<PartialList<T>>; }, first: Promise<PartialList<T>>): Promise<T[]> {
    const all: T[] = [];

    for (let list = await first; list.length || list.nextLink; list = list.nextLink ? await client.listNext(list.nextLink) : []) {
        all.push(...list);
    }

    return all;
}

export function waitForWebSiteState(webSiteManagementClient: WebSiteManagementClient, site: WebSiteModels.Site, state: string, intervalMs = 5000, timeoutMs = 60000): Promise<void> {
    return new Promise((resolve, reject) => {
        const func = async (count: number) => {
            const rgName = site.resourceGroup;
            const isSlot = isSiteDeploymentSlot(site);
            const siteName = extractSiteName(site);
            const slotName = extractDeploymentSlotName(site);
            const currentSite = await (isSlot ? webSiteManagementClient.webApps.getSlot(rgName, siteName, slotName) : webSiteManagementClient.webApps.get(rgName, siteName));

            if (currentSite.state.toLowerCase() === state.toLowerCase()) {
                resolve();
            } else {
                count += intervalMs;

                if (count < timeoutMs) {
                    setTimeout(func, intervalMs, count);
                } else {
                    reject(new Error(`Timeout waiting for Web Site "${siteName}" state "${state}".`));
                }
            }
        };
        setTimeout(func, intervalMs, intervalMs);
    });
}

export function getSignInCommandString(): string {
    return 'azure-account.login';
}

// Web app & deployment slots
export function isSiteDeploymentSlot(site: WebSiteModels.Site): boolean {
    return site.type.toLowerCase() === 'microsoft.web/sites/slots';
}

export function extractSiteName(site: WebSiteModels.Site): string {
    return isSiteDeploymentSlot(site) ? site.name.substring(0, site.name.lastIndexOf('/')) : site.name;
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
export function sendTelemetry(eventName: string, properties?: { [key: string]: string; }, measures?: { [key: string]: number; }) {
    if (reporter) {
        reporter.sendTelemetryEvent(eventName, properties, measures);
    }
}

export function errToString(error: any): string {
    if (error === null || error === undefined) {
        return '';
    }

    if (error instanceof Error) {
        try {
            // errors from Azure come as JSON string
            return JSON.stringify({
                'Error': JSON.parse(error.message).Code,
                'Message': JSON.parse(error.message).Message
            });

        } catch (e) {
            return JSON.stringify({
                'Error': error.constructor.name,
                'Message': error.message
            });
        }

    }

    if (typeof (error) === 'object') {
        return JSON.stringify({
            'object': error.constructor.name
        });
    }

    return error.toString();
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
                }
            }
        }) :
        [];
    // VS Code will handle [] by alerting user there are no workspaces opened

    const folderQuickPickOption = { placeHolder: placeHolderString };
    const pickedItem = folderQuickPickItems.length == 1 ?
        folderQuickPickItems[0] : await vscode.window.showQuickPick(folderQuickPickItems, folderQuickPickOption);

    if (!pickedItem) {
        throw new UserCancelledError;
    }

    return pickedItem.data;
}

export interface IQuickPickItemWithData<T> extends vscode.QuickPickItem {
    persistenceId?: string; // A unique key to identify this item items across sessions, used in persisting previous selections
    data?: T;
}
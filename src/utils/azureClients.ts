/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient } from '@azure/arm-appservice';
import { ResourceManagementClient } from '@azure/arm-resources';
import { AzExtClientContext, createAzureClient } from 'vscode-azureextensionui';

// Lazy-load @azure packages to improve startup performance.
// NOTE: The client is the only import that matters, the rest of the types disappear when compiled to JavaScript

export async function createWebSiteClient(clientContext: AzExtClientContext): Promise<WebSiteManagementClient> {
    return createAzureClient(clientContext, (await import('@azure/arm-appservice')).WebSiteManagementClient);
}
export async function createResourceClient(clientContext: AzExtClientContext): Promise<ResourceManagementClient> {
    return createAzureClient(clientContext, (await import('@azure/arm-resources')).ResourceManagementClient);
}

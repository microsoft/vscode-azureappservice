/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type WebSiteManagementClient } from '@azure/arm-appservice';
import { type ResourceGraphClient } from '@azure/arm-resourcegraph';
import { type ResourceManagementClient } from '@azure/arm-resources';
import { createAzureClient, createAzureSubscriptionClient, type AzExtClientContext } from '@microsoft/vscode-azext-azureutils';

// Lazy-load @azure packages to improve startup performance.
// NOTE: The client is the only import that matters, the rest of the types disappear when compiled to JavaScript

export async function createWebSiteClient(clientContext: AzExtClientContext): Promise<WebSiteManagementClient> {
    return createAzureClient(clientContext, (await import('@azure/arm-appservice')).WebSiteManagementClient);
}
export async function createResourceClient(clientContext: AzExtClientContext): Promise<ResourceManagementClient> {
    return createAzureClient(clientContext, (await import('@azure/arm-resources')).ResourceManagementClient);
}

export async function createResourceGraphClient(context: AzExtClientContext): Promise<ResourceGraphClient> {
    return createAzureSubscriptionClient(context, (await import('@azure/arm-resourcegraph')).ResourceGraphClient);
}

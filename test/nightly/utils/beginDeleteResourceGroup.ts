/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type ResourceManagementClient } from '@azure/arm-resources';
import { createSubscriptionContext, createTestActionContext, parseError, type ISubscriptionContext } from '@microsoft/vscode-azext-utils';
import { ext } from '../../../src/extensionVariables';
import { createResourceClient } from '../../../src/utils/azureClients';

let subscriptionContext: ISubscriptionContext | undefined;
let resourceClient: ResourceManagementClient | undefined;

async function ensureResourceClient(): Promise<ResourceManagementClient> {
    if (resourceClient && subscriptionContext) {
        return resourceClient;
    }

    const context = await createTestActionContext();
    const subscriptions = await ext.rgApi.getSubscriptions(true /* filter */);
    if (!subscriptions.length) {
        throw new Error('No Azure subscriptions found. Long running tests require a signed-in account and at least one selected subscription.');
    }

    subscriptionContext = createSubscriptionContext(subscriptions[0]);
    resourceClient = await createResourceClient([context, subscriptionContext]);
    return resourceClient;
}

/**
 * Deletes the given resource group using the ARM SDK.
 * Ignores "not found" errors in case the resource group was already deleted.
 */
export async function beginDeleteResourceGroup(resourceGroupName: string): Promise<void> {
    if (!resourceGroupName) {
        return;
    }

    const client = await ensureResourceClient();

    try {
        await client.resourceGroups.beginDeleteAndWait(resourceGroupName);
    } catch (error) {
        const parsed = parseError(error);
        const errorType = (parsed.errorType || '').toLowerCase();
        // Ignore "not found" errors - the resource group may already be deleted
        if (errorType === 'notfound' || errorType === 'resourcegroupnotfound') {
            return;
        }

        // Surface unexpected failures so the test run doesn't silently leak resources.
        throw error;
    }
}

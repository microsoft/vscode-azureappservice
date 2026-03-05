/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type WebSiteManagementClient } from '@azure/arm-appservice';
import { createTestActionContext } from '@microsoft/vscode-azext-utils';
import { ext, longRunningTestsEnabled } from '../global.test';
import { createWebSiteClient } from '../../src/utils/azureClients';

export let webSiteClient: WebSiteManagementClient;
export const resourceGroupsToDelete: string[] = [];

suiteSetup(async function (this: Mocha.Context): Promise<void> {
    if (!longRunningTestsEnabled) {
        return;
    }

    this.timeout(120 * 1000);

    // Initialize webSiteClient using the rgApi from the extension
    // This requires proper Azure credentials to be configured
    if (ext.rgApi) {
        try {
            const context = await createTestActionContext();
            // Get subscription from the first available subscription in rgApi
            // For tests, we need to pick a subscription - this would normally come from user selection
            const subscriptions = await ext.rgApi.pickAppResource(context, {
                // This will prompt for subscription selection in tests
            }).catch(() => null);

            if (subscriptions) {
                // webSiteClient would be initialized through the subscription context
                // For now, leave it undefined - tests will fail with clear error
                console.log('Nightly tests require Azure subscription configuration');
            }
        } catch (error) {
            console.warn('Failed to initialize webSiteClient:', error);
        }
    }
});

suiteTeardown(async function (this: Mocha.Context): Promise<void> {
    if (longRunningTestsEnabled) {
        this.timeout(10 * 60 * 1000);
        // Cleanup: delete resource groups created during tests
        // await Promise.all(resourceGroupsToDelete.map(async resource => {
        //     await beginDeleteResourceGroup(resource);
        // }));
    }
});

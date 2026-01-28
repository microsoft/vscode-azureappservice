/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type WebSiteManagementClient } from '@azure/arm-appservice';
import { longRunningTestsEnabled } from '../global.test';

export let webSiteClient: WebSiteManagementClient;
export const resourceGroupsToDelete: string[] = [];

suiteSetup(async function (this: Mocha.Context): Promise<void> {
    this.skip();
    // This was originally for the end to end azure tests but this was never updated after they were fixed. Leaving this as a placeholder in case we want to re-enable these tests in the future.
});

suiteTeardown(async function (this: Mocha.Context): Promise<void> {
    if (longRunningTestsEnabled) {
        this.timeout(10 * 60 * 1000);
        // await Promise.all(resourceGroupsToDelete.map(async resource => {
        //     await beginDeleteResourceGroup(resource);
        // }));
        // ext.azureAccountTreeItem.dispose();
    }
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient } from '@azure/arm-appservice';
import { SubscriptionTreeItemBase } from '@microsoft/vscode-azext-azureutils';
import { longRunningTestsEnabled } from '../global.test';
import { beginDeleteResourceGroup } from './utils/beginDeleteResourceGroup';

export const resourceGroupsToDelete: string[] = [];
export const subscriptionTreeItems: SubscriptionTreeItemBase[] = [];
export let testSubscription: SubscriptionTreeItemBase | undefined;
export let webSiteClient: WebSiteManagementClient;

suite('Nightly test resources', function () {

    suiteTeardown(async function (this: Mocha.Context): Promise<void> {
        if (!longRunningTestsEnabled) {
            this.timeout(10 * 60 * 1000);
            await Promise.all(resourceGroupsToDelete.map(async resource => {
                await beginDeleteResourceGroup(resource);
            }));
            // testExt.azureAccountTreeItem.dispose();
        }
    });
});



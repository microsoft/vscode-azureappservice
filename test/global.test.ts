/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient } from '@azure/arm-appservice';
import { createWebSiteClient } from '@microsoft/vscode-azext-azureappservice';
import { SubscriptionTreeItemBase } from '@microsoft/vscode-azext-azureutils';
import { createTestActionContext, registerOnActionStartHandler, testGlobalSetup, TestOutputChannel, TestUserInput } from '@microsoft/vscode-azext-utils';
import * as assert from 'assert';
import * as vscode from 'vscode';
import { ext } from '../src/extensionVariables';
import { getResourceGroupsTestApi } from './utils/resourceGroupsTestApiAccess';
import { getTestApi } from './utils/testApiAccess';

const longRunningLocalTestsEnabled: boolean = !/^(false|0)?$/i.test(process.env.AzCode_EnableLongRunningTestsLocal || '');
const longRunningRemoteTestsEnabled: boolean = !/^(false|0)?$/i.test(process.env.AzCode_UseAzureFederatedCredentials || '');

export const longRunningTestsEnabled: boolean = longRunningLocalTestsEnabled || longRunningRemoteTestsEnabled;

export let subscriptionTreeItems: SubscriptionTreeItemBase[] = [];
export let testSubscription: SubscriptionTreeItemBase | undefined;
export let webSiteClient: WebSiteManagementClient;

// Runs before all tests
suiteSetup(async function (this: Mocha.Context): Promise<void> {
    this.timeout(120 * 1000);
    const extension = vscode.extensions.getExtension('ms-azuretools.vscode-azureappservice');
    if (!extension) {
        assert.fail('Failed to find extension.');
    } else {
        await extension.activate(); // activate the extension before tests begin
    }
    testGlobalSetup();
    ext.outputChannel = new TestOutputChannel();
    await getTestApi();
    registerOnActionStartHandler(context => {
        // Use `TestUserInput` by default so we get an error if an unexpected call to `context.ui` occurs, rather than timing out
        context.ui = new TestUserInput(vscode);
    });

    if (longRunningTestsEnabled) {
        const rgTestApi = await getResourceGroupsTestApi();
        await getTestApi();

        // The tree may not have loaded subscriptions yet (especially in CI where auth can be slower).
        // Retry with backoff until subscription nodes appear.
        const maxAttempts = 10;
        const delayMs = 3000;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const rootChildren = await rgTestApi.compatibility.getAppResourceTree().getChildren();
            console.log(`Attempt ${attempt}/${maxAttempts}: getChildren() returned ${rootChildren.length} node(s)`);
            for (const child of rootChildren) {
                console.log(`  - Node: label=${(child as { label?: string }).label}, subscriptionId=${(child as { subscription?: { subscriptionId?: string } }).subscription?.subscriptionId ?? '<none>'}`);
            }

            // The RG compatibility tree may include non-subscription nodes depending on grouping; pick only nodes that actually expose a subscription context.
            subscriptionTreeItems = rootChildren.filter((c: unknown) => {
                try {
                    const subId = (c as { subscription?: { subscriptionId?: string } } | undefined)?.subscription?.subscriptionId;
                    return typeof subId === 'string' && subId.length > 0;
                } catch {
                    return false;
                }
            }) as unknown as SubscriptionTreeItemBase[];

            if (subscriptionTreeItems.length > 0) {
                break;
            }

            if (attempt < maxAttempts) {
                console.log(`No subscription nodes found yet, waiting ${delayMs}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }

        testSubscription = subscriptionTreeItems[0];
        console.log('Test subscription tree items:', subscriptionTreeItems.length);
        console.log('Test subscription:', testSubscription?.subscription?.subscriptionId);

        if (!testSubscription) {
            throw new Error(`No subscription tree items found after ${maxAttempts} attempts (${maxAttempts * delayMs / 1000}s). The Azure Resources tree may not have loaded subscriptions. Verify that authentication succeeded and VSCODE_RUNNING_TESTS is set for the Resource Groups extension.`);
        }

        const appExtension = vscode.extensions.getExtension('ms-azuretools.vscode-azureappservice');
        if (!appExtension) {
            throw new Error('Could not find the Azure App Service extension.');
        }

        // Nightly-only resource initialization would go here.
        webSiteClient = await createWebSiteClient([await createTestActionContext(), testSubscription.subscription]);
    }
});

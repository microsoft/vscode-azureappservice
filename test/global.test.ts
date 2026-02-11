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
        const rootChildren = await rgTestApi.compatibility.getAppResourceTree().getChildren();
        await getTestApi();
        // The RG compatibility tree may include non-subscription nodes depending on grouping; pick only nodes that actually expose a subscription context.
        subscriptionTreeItems = rootChildren.filter((c: unknown) => {
            try {
                const subId = (c as { subscription?: { subscriptionId?: string } } | undefined)?.subscription?.subscriptionId;
                return typeof subId === 'string' && subId.length > 0;
            } catch {
                return false;
            }
        }) as unknown as SubscriptionTreeItemBase[];
        testSubscription = subscriptionTreeItems[0];
        console.log('Test subscription tree items:', subscriptionTreeItems);
        console.log('Test subscription:', testSubscription);

        const appExtension = vscode.extensions.getExtension('ms-azuretools.vscode-azureappservice');
        if (!appExtension) {
            throw new Error('Could not find the Azure App Service extension.');
        }

        // Nightly-only resource initialization would go here.
        webSiteClient = await createWebSiteClient([await createTestActionContext(), testSubscription.subscription]);
    }
});

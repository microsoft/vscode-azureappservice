/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type WebSiteManagementClient } from '@azure/arm-appservice';
import { ResourceManagementClient } from '@azure/arm-resources';
import { createAzureClient } from '@microsoft/vscode-azext-azureutils';
import { createTestActionContext, type TestActionContext } from '@microsoft/vscode-azext-dev';
import { type AzureSubscription } from '@microsoft/vscode-azureresources-api';
import * as vscode from 'vscode';
import { createSubscriptionContext, createWebSiteClient, ext, subscriptionExperience, type ISubscriptionContext } from '../../extension.bundle';
import { longRunningTestsEnabled } from '../global.test';

export let subscriptionContext: ISubscriptionContext;
export let webSiteClient: WebSiteManagementClient;
export const resourceGroupsToDelete = new Set<string>();
export const azcodePrefix: string = 'azcode';

suiteSetup(async function (this: Mocha.Context): Promise<void> {
    if (!longRunningTestsEnabled) {
        this.skip();
    }

    this.timeout(2 * 60 * 1000);
    await vscode.commands.executeCommand('azureResourceGroups.logIn');

    const context: TestActionContext = await createTestActionContext();
    const subscription: AzureSubscription = await subscriptionExperience(context, ext.rgApi.appResourceTree);
    subscriptionContext = createSubscriptionContext(subscription);

    webSiteClient = await createWebSiteClient([context, subscriptionContext]);
});

suiteTeardown(async function (this: Mocha.Context): Promise<void> {
    if (!longRunningTestsEnabled) {
        return;
    }

    this.timeout(10 * 60 * 1000);
    await deleteResourceGroups();
});

async function deleteResourceGroups(): Promise<void> {
    const context: TestActionContext = await createTestActionContext();
    const rgClient: ResourceManagementClient = createAzureClient([context, subscriptionContext], ResourceManagementClient);

    await Promise.all(Array.from(resourceGroupsToDelete).map(async resourceGroup => {
        if (!(await rgClient.resourceGroups.checkExistence(resourceGroup)).body) {
            return;
        }

        console.log(`Deleting resource group "${resourceGroup}"...`);
        await rgClient.resourceGroups.beginDeleteAndWait(resourceGroup);
        console.log(`Successfully deleted resource group "${resourceGroup}".`);
    }));
}

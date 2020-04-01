/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceManagementClient } from 'azure-arm-resource';
import { WebSiteManagementClient } from 'azure-arm-website';
import * as vscode from 'vscode';
import { TestAzureAccount } from 'vscode-azureextensiondev';
import { AzExtTreeDataProvider, AzureAccountTreeItem, createAzureClient, ext } from '../../extension.bundle';
import { longRunningTestsEnabled } from '../global.test';

export let testAccount: TestAzureAccount;
export let webSiteClient: WebSiteManagementClient;
export const resourceGroupsToDelete: string[] = [];

suiteSetup(async function (this: Mocha.Context): Promise<void> {
    if (longRunningTestsEnabled) {
        this.timeout(2 * 60 * 1000);
        testAccount = new TestAzureAccount(vscode);
        await testAccount.signIn();
        ext.azureAccountTreeItem = new AzureAccountTreeItem(testAccount);
        ext.tree = new AzExtTreeDataProvider(ext.azureAccountTreeItem, 'appService.loadMore');
        webSiteClient = createAzureClient(testAccount.getSubscriptionContext(), WebSiteManagementClient);
    }
});

suiteTeardown(async function (this: Mocha.Context): Promise<void> {
    if (longRunningTestsEnabled) {
        this.timeout(10 * 60 * 1000);
        await deleteResourceGroups();
        ext.azureAccountTreeItem.dispose();
    }
});

async function deleteResourceGroups(): Promise<void> {
    const client: ResourceManagementClient = createAzureClient(testAccount.getSubscriptionContext(), ResourceManagementClient);
    await Promise.all(resourceGroupsToDelete.map(async resourceGroup => {
        if (await client.resourceGroups.checkExistence(resourceGroup)) {
            console.log(`Deleting resource group "${resourceGroup}"...`);
            await client.resourceGroups.deleteMethod(resourceGroup);
            console.log(`Resource group "${resourceGroup}" deleted.`);
        } else {
            // If the test failed, the resource group might not actually exist
            console.log(`Ignoring resource group "${resourceGroup}" because it does not exist.`);
        }
    }));
}

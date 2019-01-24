/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ResourceManagementClient } from 'azure-arm-resource';
import { WebSiteManagementClient, WebSiteManagementModels } from 'azure-arm-website';
import { IHookCallbackContext, ISuiteCallbackContext } from 'mocha';
import * as vscode from 'vscode';
import { deleteDefaultResourceGroup, longRunningTestsEnabled } from './global.test';
import { AzureTreeDataProvider, constants, DialogResponses, ext, getRandomHexString, ILinuxRuntimeStack, SiteRuntimeStep, TestAzureAccount, TestUserInput, WebAppProvider } from '../extension.bundle';

suite('Create Azure Resources', async function (this: ISuiteCallbackContext): Promise<void> {
    this.timeout(1200 * 1000);
    const resourceGroupsToDelete: string[] = [];
    const testAccount: TestAzureAccount = new TestAzureAccount();
    // tslint:disable-next-line:no-backbone-get-set-outside-model
    const oldAdvancedCreationSetting: boolean | undefined = <boolean>vscode.workspace.getConfiguration(constants.extensionPrefix).get('advancedCreation');
    const runtimeLTS: ILinuxRuntimeStack | undefined = new SiteRuntimeStep().getLinuxRuntimeStack().find((runtime: ILinuxRuntimeStack) => {
        return runtime.displayName.includes('LTS - Recommended for new apps');
    });
    if (!runtimeLTS) {
        throw new Error('No LTS runtime was found.');
    }

    suiteSetup(async function (this: IHookCallbackContext): Promise<void> {
        if (!longRunningTestsEnabled) {
            this.skip();
        }
        this.timeout(120 * 1000);
        await testAccount.signIn();
        ext.tree = new AzureTreeDataProvider(WebAppProvider, 'appService.startTesting', undefined, testAccount);
        ext.treeView = vscode.window.createTreeView('azureAppService', { treeDataProvider: ext.tree });
    });

    suiteTeardown(async function (this: IHookCallbackContext): Promise<void> {
        if (!longRunningTestsEnabled) {
            this.skip();
        }
        await vscode.workspace.getConfiguration(constants.extensionPrefix).update('advancedCreation', oldAdvancedCreationSetting, vscode.ConfigurationTarget.Global);
        this.timeout(1200 * 1000);
        const client: ResourceManagementClient = getResourceManagementClient(testAccount);
        for (const resourceGroup of resourceGroupsToDelete) {
            if (await client.resourceGroups.checkExistence(resourceGroup)) {
                console.log(`Deleting resource group "${resourceGroup}"...`);
                await client.resourceGroups.deleteMethod(resourceGroup);
                console.log(`Resource group "${resourceGroup}" deleted.`);
            } else {
                // If the test failed, the resource group might not actually exist
                console.log(`Ignoring resource group "${resourceGroup}" because it does not exist.`);
            }
        }
        ext.tree.dispose();
    });

    test('Create and Delete New Web App (Basic)', async () => {
        const appName: string = getRandomHexString().toLowerCase();
        await vscode.workspace.getConfiguration(constants.extensionPrefix).update('advancedCreation', false, vscode.ConfigurationTarget.Global);
        const testInputs: string[] = [appName, 'Linux', runtimeLTS.displayName];
        ext.ui = new TestUserInput(testInputs);

        await vscode.commands.executeCommand('appService.CreateWebApp');
        const client: WebSiteManagementClient = getWebsiteManagementClient(testAccount);
        const defaultRgName: string = 'appsvc_rg_linux_centralus';
        const createdApp: WebSiteManagementModels.Site = await client.webApps.get(defaultRgName, appName);
        assert.ok(createdApp);
        if (deleteDefaultResourceGroup) {
            resourceGroupsToDelete.push(defaultRgName);
        }

        ext.ui = new TestUserInput([appName, DialogResponses.deleteResponse.title, DialogResponses.yes.title]);
        await vscode.commands.executeCommand('appService.Delete');
        const deletedApp: WebSiteManagementModels.Site | undefined = await client.webApps.get(defaultRgName, appName);
        assert.ifError(deletedApp); // if app was deleted, get() returns null.  assert.ifError throws if the value passed is not null/undefined
    });

    test('Create and Delete New Web App (Advanced)', async () => {
        const resourceName: string = getRandomHexString().toLowerCase();
        await vscode.workspace.getConfiguration(constants.extensionPrefix).update('advancedCreation', true, vscode.ConfigurationTarget.Global);
        const testInputs: string[] = [resourceName, '$(plus) Create new resource group', resourceName, 'Linux', runtimeLTS.displayName, '$(plus) Create new App Service plan', resourceName, 'B1', 'West US'];
        ext.ui = new TestUserInput(testInputs);

        await vscode.commands.executeCommand('appService.CreateWebApp');
        const client: WebSiteManagementClient = getWebsiteManagementClient(testAccount);
        const createdApp: WebSiteManagementModels.Site = await client.webApps.get(resourceName, resourceName);
        assert.ok(createdApp);
        resourceGroupsToDelete.push(resourceName);

        ext.ui = new TestUserInput([resourceName, DialogResponses.deleteResponse.title, DialogResponses.yes.title]);
        await vscode.commands.executeCommand('appService.Delete');
        const deletedApp: WebSiteManagementModels.Site | undefined = await client.webApps.get(resourceName, resourceName);
        assert.ifError(deletedApp); // if app was deleted, get() returns null.  assert.ifError throws if the value passed is not null/undefined
    });
});

function getWebsiteManagementClient(testAccount: TestAzureAccount): WebSiteManagementClient {
    return new WebSiteManagementClient(testAccount.getSubscriptionCredentials(), testAccount.getSubscriptionId());
}

function getResourceManagementClient(testAccount: TestAzureAccount): ResourceManagementClient {
    return new ResourceManagementClient(testAccount.getSubscriptionCredentials(), testAccount.getSubscriptionId());
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ResourceManagementClient } from 'azure-arm-resource';
import { WebSiteManagementClient, WebSiteManagementModels } from 'azure-arm-website';
import { IHookCallbackContext, ISuiteCallbackContext } from 'mocha';
import * as vscode from 'vscode';
import { AzExtTreeDataProvider, AzureAccountTreeItem, constants, DialogResponses, ext, getRandomHexString, TestAzureAccount, TestUserInput } from '../extension.bundle';
import { longRunningTestsEnabled } from './global.test';

suite('Create Azure Resources', async function (this: ISuiteCallbackContext): Promise<void> {
    this.timeout(1200 * 1000);
    const resourceGroupsToDelete: string[] = [];
    const testAccount: TestAzureAccount = new TestAzureAccount();
    let oldAdvancedCreationSetting: boolean | undefined;
    const regExpLTS: RegExp = /LTS/g;
    const resourceName1: string = getRandomHexString().toLowerCase();
    let webSiteClient: WebSiteManagementClient;
    const resourceGroupName: string = 'appsvc_rg_windows_centralus';

    suiteSetup(async function (this: IHookCallbackContext): Promise<void> {
        if (!longRunningTestsEnabled) {
            this.skip();
        }
        oldAdvancedCreationSetting = <boolean>vscode.workspace.getConfiguration(constants.extensionPrefix).get('advancedCreation');
        this.timeout(120 * 1000);
        await testAccount.signIn();
        ext.azureAccountTreeItem = new AzureAccountTreeItem(testAccount);
        ext.tree = new AzExtTreeDataProvider(ext.azureAccountTreeItem, 'appService.loadMore');
        webSiteClient = getWebsiteManagementClient(testAccount);
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
        ext.azureAccountTreeItem.dispose();
    });

    test('Create and Delete New Web App (Advanced)', async () => {
        const resourceName2: string = getRandomHexString().toLowerCase();
        await vscode.workspace.getConfiguration(constants.extensionPrefix).update('advancedCreation', true, vscode.ConfigurationTarget.Global);
        const testInputs: (string | RegExp)[] = [resourceName2, '$(plus) Create new resource group', resourceName2, 'Linux', regExpLTS, '$(plus) Create new App Service plan', resourceName2, 'B1', 'West US'];
        ext.ui = new TestUserInput(testInputs);

        resourceGroupsToDelete.push(resourceName2);
        await vscode.commands.executeCommand('appService.CreateWebApp');
        const createdApp: WebSiteManagementModels.Site = await webSiteClient.webApps.get(resourceName2, resourceName2);
        assert.ok(createdApp);

        ext.ui = new TestUserInput([resourceName2, DialogResponses.deleteResponse.title, DialogResponses.yes.title]);
        await vscode.commands.executeCommand('appService.Delete');
        const deletedApp: WebSiteManagementModels.Site | undefined = await webSiteClient.webApps.get(resourceName2, resourceName2);
        assert.ifError(deletedApp); // if app was deleted, get() returns null.  assert.ifError throws if the value passed is not null/undefined
    });

    test('Create and Delete New Web App (Basic)', async () => {
        resourceGroupsToDelete.push(resourceGroupName);
        await vscode.workspace.getConfiguration(constants.extensionPrefix).update('advancedCreation', false, vscode.ConfigurationTarget.Global);
        ext.ui = new TestUserInput([resourceName1, 'Windows']);
        await vscode.commands.executeCommand('appService.CreateWebApp');
        const createdApp: WebSiteManagementModels.Site = await webSiteClient.webApps.get(resourceGroupName, resourceName1);
        assert.ok(createdApp);
    });

    test('Stop Web App', async () => {
        let createdApp: WebSiteManagementModels.Site;
        createdApp = await webSiteClient.webApps.get(resourceGroupName, resourceName1);
        assert.equal(createdApp.state, 'Running', `Web App state should be 'Running' rather than ${createdApp.state} before stop.`);
        ext.ui = new TestUserInput([resourceName1]);
        await vscode.commands.executeCommand('appService.Stop');
        createdApp = await webSiteClient.webApps.get(resourceGroupName, resourceName1);
        assert.equal(createdApp.state, 'Stopped', `Web App state should be 'Stopped' rather than ${createdApp.state}.`);
    });

    test('Start Web App', async () => {
        let createdApp: WebSiteManagementModels.Site;
        createdApp = await webSiteClient.webApps.get(resourceGroupName, resourceName1);
        assert.equal(createdApp.state, 'Stopped', `Web App state should be 'Stopped' rather than ${createdApp.state} before start.`);
        ext.ui = new TestUserInput([resourceName1]);
        await vscode.commands.executeCommand('appService.Start');
        createdApp = await webSiteClient.webApps.get(resourceGroupName, resourceName1);
        assert.equal(createdApp.state, 'Running', `Web App state should be 'Running' rather than ${createdApp.state}.`);
    });

    test('Restart Web App', async () => {
        let createdApp: WebSiteManagementModels.Site;
        createdApp = await webSiteClient.webApps.get(resourceGroupName, resourceName1);
        assert.equal(createdApp.state, 'Running', `Web App state should be 'Running' rather than ${createdApp.state} before restart.`);
        ext.ui = new TestUserInput([resourceName1, resourceName1]);
        await vscode.commands.executeCommand('appService.Restart');
        createdApp = await webSiteClient.webApps.get(resourceGroupName, resourceName1);
        assert.equal(createdApp.state, 'Running', `Web App state should be 'Running' rather than ${createdApp.state}.`);
    });
});

function getWebsiteManagementClient(testAccount: TestAzureAccount): WebSiteManagementClient {
    return new WebSiteManagementClient(testAccount.getSubscriptionCredentials(), testAccount.getSubscriptionId());
}

function getResourceManagementClient(testAccount: TestAzureAccount): ResourceManagementClient {
    return new ResourceManagementClient(testAccount.getSubscriptionCredentials(), testAccount.getSubscriptionId());
}

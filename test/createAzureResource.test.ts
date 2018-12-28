/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ResourceManagementClient } from 'azure-arm-resource';
import { WebSiteManagementClient, WebSiteManagementModels } from 'azure-arm-website';
import * as crypto from "crypto";
import { IHookCallbackContext, ISuiteCallbackContext } from 'mocha';
import * as vscode from 'vscode';
import { AzureTreeDataProvider, DialogResponses, TestAzureAccount, TestUserInput } from 'vscode-azureextensionui';
import * as constants from '../src/constants';
import { WebAppProvider } from '../src/explorer/WebAppProvider';
import { ext } from '../src/extensionVariables';
import { longRunningTestsEnabled } from './global.test';

suite('Create Azure Resources', async function (this: ISuiteCallbackContext): Promise<void> {
    this.timeout(1200 * 1000);
    const resourceGroupsToDelete: string[] = [];
    const testAccount: TestAzureAccount = new TestAzureAccount();
    // tslint:disable-next-line:no-backbone-get-set-outside-model
    const advancedCreationSetting: boolean | undefined = <boolean>vscode.workspace.getConfiguration(constants.extensionPrefix).get('advancedCreation');

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
        await vscode.workspace.getConfiguration(constants.extensionPrefix).update('advancedCreation', advancedCreationSetting, vscode.ConfigurationTarget.Global);
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
        const testInputs: string[] = [appName, 'Linux', 'Node.js 10.10 (LTS - Recommended for new apps)'];
        ext.ui = new TestUserInput(testInputs);

        await vscode.commands.executeCommand('appService.CreateWebApp');
        const client: WebSiteManagementClient = getWebsiteManagementClient(testAccount);
        const defaultRgName: string = 'appsvc_rg_linux_centralus';
        const createdApp: WebSiteManagementModels.Site = await client.webApps.get(defaultRgName, appName);
        assert.ok(createdApp);

        ext.ui = new TestUserInput([appName, DialogResponses.deleteResponse.title, DialogResponses.yes.title]);
        await vscode.commands.executeCommand('appService.Delete');
        const deletedApp: WebSiteManagementModels.Site | undefined = await client.webApps.get(defaultRgName, appName);
        assert.ifError(deletedApp); // if app was deleted, get() returns null.  assert.ifError throws if the value passed is not null/undefined
    });

    test('Create and Delete New Web App (Advanced)', async () => {
        const resourceName: string = getRandomHexString().toLowerCase();
        resourceGroupsToDelete.push(resourceName);
        await vscode.workspace.getConfiguration(constants.extensionPrefix).update('advancedCreation', true, vscode.ConfigurationTarget.Global);

        const testInputs: string[] = [resourceName, '$(plus) Create new resource group', resourceName, 'Linux', 'Node.js 10.10 (LTS - Recommended for new apps)', '$(plus) Create new App Service plan', resourceName, 'B1', 'West US'];
        ext.ui = new TestUserInput(testInputs);

        await vscode.commands.executeCommand('appService.CreateWebApp');
        const client: WebSiteManagementClient = getWebsiteManagementClient(testAccount);
        const createdApp: WebSiteManagementModels.Site = await client.webApps.get(resourceName, resourceName);
        assert.ok(createdApp);

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

function getRandomHexString(length: number = 10): string {
    const buffer: Buffer = crypto.randomBytes(Math.ceil(length / 2));
    return buffer.toString('hex').slice(0, length);
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ResourceManagementClient } from 'azure-arm-resource';
import { WebSiteManagementClient, WebSiteManagementModels } from 'azure-arm-website';
import * as fse from 'fs-extra';
import { IHookCallbackContext, ISuiteCallbackContext } from 'mocha';
import * as path from 'path';
import * as vscode from 'vscode';
import { WebsiteOS } from 'vscode-azureappservice';
import { AzExtTreeDataProvider, AzureAccountTreeItem, AzureTreeItem, constants, DialogResponses, ext, getRandomHexString, getResourcesPath, IActionContext, TestAzureAccount, TestUserInput } from '../extension.bundle';
import { longRunningTestsEnabled, pricingTier } from './global.test';

// tslint:disable-next-line: max-func-body-length
suite('Create Azure Resources', async function (this: ISuiteCallbackContext): Promise<void> {
    this.timeout(1200 * 1000);
    const resourceGroupsToDelete: string[] = [];
    const testAccount: TestAzureAccount = new TestAzureAccount();
    let oldAdvancedCreationSetting: boolean | undefined;
    const regExpLTS: RegExp = /LTS/g;
    const resourceName: string = getRandomHexString().toLowerCase();
    let webSiteClient: WebSiteManagementClient;

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

    test('Create New Web App (Advanced)', async () => {
        await vscode.workspace.getConfiguration(constants.extensionPrefix).update('advancedCreation', true, vscode.ConfigurationTarget.Global);
        const testInputs: (string | RegExp)[] = [resourceName, '$(plus) Create new resource group', resourceName, 'Linux', regExpLTS, '$(plus) Create new App Service plan', resourceName, pricingTier.B1, 'West US'];
        ext.ui = new TestUserInput(testInputs);

        resourceGroupsToDelete.push(resourceName);
        await vscode.commands.executeCommand('appService.CreateWebApp');
        const createdApp: WebSiteManagementModels.Site = await webSiteClient.webApps.get(resourceName, resourceName);
        assert.ok(createdApp);
    });

    test('Stop Web App', async () => {
        let createdApp: WebSiteManagementModels.Site;
        createdApp = await webSiteClient.webApps.get(resourceName, resourceName);
        assert.equal(createdApp.state, 'Running', `Web App state should be 'Running' rather than ${createdApp.state} before stop.`);
        ext.ui = new TestUserInput([resourceName]);
        await vscode.commands.executeCommand('appService.Stop');
        createdApp = await webSiteClient.webApps.get(resourceName, resourceName);
        assert.equal(createdApp.state, 'Stopped', `Web App state should be 'Stopped' rather than ${createdApp.state}.`);
    });

    test('Start Web App', async () => {
        let createdApp: WebSiteManagementModels.Site;
        createdApp = await webSiteClient.webApps.get(resourceName, resourceName);
        assert.equal(createdApp.state, 'Stopped', `Web App state should be 'Stopped' rather than ${createdApp.state} before start.`);
        ext.ui = new TestUserInput([resourceName]);
        await vscode.commands.executeCommand('appService.Start');
        createdApp = await webSiteClient.webApps.get(resourceName, resourceName);
        assert.equal(createdApp.state, 'Running', `Web App state should be 'Running' rather than ${createdApp.state}.`);
    });

    test('Restart Web App', async () => {
        let createdApp: WebSiteManagementModels.Site;
        createdApp = await webSiteClient.webApps.get(resourceName, resourceName);
        assert.equal(createdApp.state, 'Running', `Web App state should be 'Running' rather than ${createdApp.state} before restart.`);
        ext.ui = new TestUserInput([resourceName, resourceName]);
        await vscode.commands.executeCommand('appService.Restart');
        createdApp = await webSiteClient.webApps.get(resourceName, resourceName);
        assert.equal(createdApp.state, 'Running', `Web App state should be 'Running' rather than ${createdApp.state}.`);
    });

    test('Configure Deployment Source to LocalGit', async () => {
        let createdApp: WebSiteManagementModels.SiteConfigResource = await webSiteClient.webApps.getConfiguration(resourceName, resourceName);
        assert.notEqual(createdApp.scmType, constants.ScmType.LocalGit, `Web App scmType's property value shouldn't be ${createdApp.scmType} before "Configure Deployment Source to LocalGit".`);
        ext.ui = new TestUserInput([resourceName, constants.ScmType.LocalGit]);
        await vscode.commands.executeCommand('appService.ConfigureDeploymentSource');
        createdApp = await webSiteClient.webApps.getConfiguration(resourceName, resourceName);
        assert.equal(createdApp.scmType, constants.ScmType.LocalGit, `Web App scmType's property value should be ${constants.ScmType.LocalGit} rather than ${createdApp.scmType}.`);
    });

    test('Configure Deployment Source to None', async () => {
        let createdApp: WebSiteManagementModels.SiteConfigResource = await webSiteClient.webApps.getConfiguration(resourceName, resourceName);
        assert.notEqual(createdApp.scmType, constants.ScmType.None, `Web App scmType's property value shouldn't be ${createdApp.scmType} before "Configure Deployment Source to None".`);
        ext.ui = new TestUserInput([resourceName, constants.ScmType.None]);
        await vscode.commands.executeCommand('appService.ConfigureDeploymentSource');
        createdApp = await webSiteClient.webApps.getConfiguration(resourceName, resourceName);
        assert.equal(createdApp.scmType, constants.ScmType.None, `Web App scmType's property value should be ${constants.ScmType.None} rather than ${createdApp.scmType}.`);
    });

    test('Generate Azure CLI Script', async () => {
        const scriptTemplate: string = await generateAzureCLIScript('linux-default.sh', 'windows-default.sh');
        ext.ui = new TestUserInput([resourceName]);
        await vscode.commands.executeCommand('appService.DeploymentScript');
        const scriptContent: string = (<vscode.TextEditor>vscode.window.activeTextEditor).document.getText();
        assert.equal(scriptContent, scriptTemplate);
    });

    test('Delete Web App', async () => {
        const createdApp: WebSiteManagementModels.Site = await webSiteClient.webApps.get(resourceName, resourceName);
        assert.ok(createdApp);
        ext.ui = new TestUserInput([resourceName, DialogResponses.deleteResponse.title, DialogResponses.yes.title]);
        await vscode.commands.executeCommand('appService.Delete');
        const deletedApp: WebSiteManagementModels.Site | undefined = await webSiteClient.webApps.get(resourceName, resourceName);
        assert.ifError(deletedApp); // if app was deleted, get() returns null.  assert.ifError throws if the value passed is not null/undefined
    });

    async function generateAzureCLIScript(linuxDefault: string, windowsDefault: string): Promise<string> {
        let script: string;
        // tslint:disable-next-line: prefer-const
        let context: IActionContext | undefined;
        const createdApp: WebSiteManagementModels.Site = await webSiteClient.webApps.get(resourceName, resourceName);
        assert.ok(createdApp);
        const getWebAppConfiguration: WebSiteManagementModels.SiteConfigResource = await webSiteClient.webApps.getConfiguration(resourceName, resourceName);
        const subscriptionName: string = (<AzureTreeItem>await ext.azureAccountTreeItem.treeDataProvider.findTreeItem(<string>createdApp.id, <IActionContext>context)).root.subscriptionDisplayName;
        const planName: string = (<string>createdApp.serverFarmId).split('/')[((<string>createdApp.serverFarmId).split('/')).length - 1];
        let templatePath: string = path.join(getResourcesPath(), 'deploymentScripts', windowsDefault);
        if ((<string>createdApp.kind).split(',')[1] === WebsiteOS.linux) {
            templatePath = path.join(getResourcesPath(), 'deploymentScripts', linuxDefault);
        }
        const scriptTemplate: string = <string>await fse.readFile(templatePath, 'utf-8');
        script = scriptTemplate.replace('%SUBSCRIPTION_NAME%', subscriptionName)
            .replace('%RG_NAME%', <string>createdApp.resourceGroup)
            .replace('%LOCATION%', (createdApp.location).replace(/\s*/g, "").toLowerCase())
            .replace('%PLAN_NAME%', planName)
            .replace('%PLAN_SKU%', pricingTier.B1)
            .replace('%SITE_NAME%', <string>createdApp.repositorySiteName);
        if ((<string>createdApp.kind).split(',')[1] === WebsiteOS.linux) {
            script = script.replace('%RUNTIME%', <string>getWebAppConfiguration.linuxFxVersion);
        }
        return script;
    }
});

function getWebsiteManagementClient(testAccount: TestAzureAccount): WebSiteManagementClient {
    return new WebSiteManagementClient(testAccount.getSubscriptionCredentials(), testAccount.getSubscriptionId());
}

function getResourceManagementClient(testAccount: TestAzureAccount): ResourceManagementClient {
    return new ResourceManagementClient(testAccount.getSubscriptionCredentials(), testAccount.getSubscriptionId());
}

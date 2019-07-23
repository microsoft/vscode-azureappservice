/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ResourceManagementClient } from 'azure-arm-resource';
import { WebSiteManagementClient, WebSiteManagementModels } from 'azure-arm-website';
import { IHookCallbackContext, ISuiteCallbackContext } from 'mocha';
import * as path from 'path';
import * as request from 'request-promise';
import * as vscode from 'vscode';
import { AzExtTreeDataProvider, AzureAccountTreeItem, constants, DialogResponses, ext, getRandomHexString, TestAzureAccount, TestUserInput } from '../extension.bundle';
import { longRunningTestsEnabled } from './global.test';

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
        const testInputs: (string | RegExp)[] = [resourceName, '$(plus) Create new resource group', resourceName, 'Linux', regExpLTS, '$(plus) Create new App Service plan', resourceName, 'B1', 'West US'];
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

    test('Delete Web App', async () => {
        const createdApp: WebSiteManagementModels.Site = await webSiteClient.webApps.get(resourceName, resourceName);
        assert.ok(createdApp);
        ext.ui = new TestUserInput([resourceName, DialogResponses.deleteResponse.title, DialogResponses.yes.title]);
        await vscode.commands.executeCommand('appService.Delete');
        const deletedApp: WebSiteManagementModels.Site | undefined = await webSiteClient.webApps.get(resourceName, resourceName);
        assert.ifError(deletedApp); // if app was deleted, get() returns null.  assert.ifError throws if the value passed is not null/undefined
    });

    test('Create a new windows Web app and deploying zips to Web App', async () => {
        const resourceGroupName: string = getRandomHexString();
        const webAppName: string = getRandomHexString();
        const AppServicePlan: string = getRandomHexString();
        resourceGroupsToDelete.push(resourceGroupName);
        const testInputs: string[] = [getTestRootZipFile(), '$(plus) Create new Web App...', webAppName, '$(plus) Create new resource group', resourceGroupName, 'Windows', '$(plus) Create new App Service plan', AppServicePlan, 'S1', 'West US', 'Deploy'];
        await testDeploy(testInputs, webAppName);
    });

    test('Create a new windows Web app and deploying folders to Web App', async () => {
        const resourceGroupName: string = getRandomHexString();
        const webAppName: string = getRandomHexString();
        const AppServicePlan: string = getRandomHexString();
        const testInputs: string[] = [];
        resourceGroupsToDelete.push(resourceGroupName);
        const projectFolder: string = path.join(__dirname, '../../test/testFolder/nodejs-docs-hello-world-master');
        testInputs.unshift(projectFolder, '$(plus) Create new Web App...', webAppName, '$(plus) Create new resource group', resourceGroupName, 'Windows', '$(plus) Create new App Service plan', AppServicePlan, 'S1', 'West US', 'Deploy');
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            testInputs.unshift('$(file-directory) Browse...'); // If the test environment has an open workspace, select the 'Browse...' option
        }
        await testDeploy(testInputs, webAppName);
    });

    async function testDeploy(createDeployInputs: string[], webAppName: string): Promise<void> {
        await vscode.workspace.getConfiguration(constants.extensionPrefix).update('advancedCreation', true, vscode.ConfigurationTarget.Global);
        ext.ui = new TestUserInput(createDeployInputs);
        await vscode.commands.executeCommand('appService.Deploy');
        const result: string = await getBody(`https://${webAppName}.azurewebsites.net`);
        assert.equal(result, `Hello World!`, `The result should be "Hello World!" rather than ${result}`);
    }
});

function getWebsiteManagementClient(testAccount: TestAzureAccount): WebSiteManagementClient {
    return new WebSiteManagementClient(testAccount.getSubscriptionCredentials(), testAccount.getSubscriptionId());
}

function getResourceManagementClient(testAccount: TestAzureAccount): ResourceManagementClient {
    return new ResourceManagementClient(testAccount.getSubscriptionCredentials(), testAccount.getSubscriptionId());
}

// The root workspace ".zip" that vscode is opened against for tests
function getTestRootZipFile(): string {
    let testRootZipFile: string = '';
    if (!testRootZipFile) {
        // We're expecting to be opened against the test/test.code-workspace
        // workspace.
        const workspaceFolders: vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            console.error("No workspace is open.");
            process.exit(1);
        } else {
            if (workspaceFolders.length > 1) {
                console.error("There are unexpected multiple workspaces open");
                process.exit(1);
            }
            testRootZipFile = workspaceFolders[0].name;
            console.log(`testRootFolder: ${testRootZipFile}`);
            if (testRootZipFile !== 'nodejs-docs-hello-world-master.zip') {
                console.error("vscode is opened against the wrong folder for tests");
                process.exit(1);
            }
        }
    }
    return testRootZipFile;
}

async function getBody(url: string): Promise<string> {
    const options: request.OptionsWithUri = {
        method: 'GET',
        uri: url,
        json: true
    };
    return await <Thenable<string>>request(options).promise();
}

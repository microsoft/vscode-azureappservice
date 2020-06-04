/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { WebSiteManagementModels } from 'azure-arm-website';
import * as vscode from 'vscode';
import { WebsiteOS } from 'vscode-azureappservice';
import { constants, DialogResponses, getRandomHexString } from '../../extension.bundle';
import { longRunningTestsEnabled, testUserInput } from '../global.test';
import { resourceGroupsToDelete, webSiteClient } from './global.resource.test';

suite('Web App actions', async function (this: Mocha.Suite): Promise<void> {
    this.timeout(6 * 60 * 1000);
    let resourceName: string;
    let appSettingKey: string;
    let appSettingValue: string;
    const WebsiteOS0: WebsiteOS = (new Date().getDate()) % 2 === 0 ? WebsiteOS.linux : WebsiteOS.windows;
    const WebsiteOS1: WebsiteOS = WebsiteOS0 === WebsiteOS.windows ? WebsiteOS.linux : WebsiteOS.windows;

    suiteSetup(async function (this: Mocha.Context): Promise<void> {
        if (!longRunningTestsEnabled) {
            this.skip();
        }
        resourceName = getRandomHexString();
        appSettingKey = getRandomHexString();
        appSettingValue = getRandomHexString();
    });

    test(`Create New ${WebsiteOS0} Web App (Advanced)`, async () => {
        const testInputs: (string | RegExp)[] = [resourceName, '$(plus) Create new resource group', resourceName, ...await getInput(WebsiteOS0), '$(plus) Create new App Service plan', resourceName, 'B1', '$(plus) Create new Application Insights resource', resourceName, 'West US'];
        resourceGroupsToDelete.push(resourceName);
        await testUserInput.runWithInputs(testInputs, async () => {
            await vscode.commands.executeCommand('appService.CreateWebAppAdvanced');
        });
        const createdApp: WebSiteManagementModels.Site = await webSiteClient.webApps.get(resourceName, resourceName);
        assert.ok(createdApp);
    });

    test(`Create New ${WebsiteOS1} Web App (Advanced)`, async () => {
        const resourceGroupName: string = getRandomHexString();
        const webAppName: string = getRandomHexString();
        const appServicePlanName: string = getRandomHexString();
        const applicationInsightsName: string = getRandomHexString();
        resourceGroupsToDelete.push(resourceGroupName);
        const testInputs: (string | RegExp)[] = [webAppName, '$(plus) Create new resource group', resourceGroupName, ...await getInput(WebsiteOS1), '$(plus) Create new App Service plan', appServicePlanName, 'S1', '$(plus) Create new Application Insights resource', applicationInsightsName, 'East US'];
        await testUserInput.runWithInputs(testInputs, async () => {
            await vscode.commands.executeCommand('appService.CreateWebAppAdvanced');
        });
        const createdApp: WebSiteManagementModels.Site = await webSiteClient.webApps.get(resourceGroupName, webAppName);
        assert.ok(createdApp);
    });

    test(`Stop ${WebsiteOS0} Web App`, async () => {
        let createdApp: WebSiteManagementModels.Site;
        createdApp = await webSiteClient.webApps.get(resourceName, resourceName);
        assert.equal(createdApp.state, 'Running', `Web App state should be 'Running' rather than ${createdApp.state} before stop.`);
        await testUserInput.runWithInputs([resourceName], async () => {
            await vscode.commands.executeCommand('appService.Stop');
        });
        createdApp = await webSiteClient.webApps.get(resourceName, resourceName);
        assert.equal(createdApp.state, 'Stopped', `Web App state should be 'Stopped' rather than ${createdApp.state}.`);
    });

    test(`Start ${WebsiteOS0} Web App`, async () => {
        let createdApp: WebSiteManagementModels.Site;
        createdApp = await webSiteClient.webApps.get(resourceName, resourceName);
        assert.equal(createdApp.state, 'Stopped', `Web App state should be 'Stopped' rather than ${createdApp.state} before start.`);
        await testUserInput.runWithInputs([resourceName], async () => {
            await vscode.commands.executeCommand('appService.Start');
        });
        createdApp = await webSiteClient.webApps.get(resourceName, resourceName);
        assert.equal(createdApp.state, 'Running', `Web App state should be 'Running' rather than ${createdApp.state}.`);
    });

    test(`Restart ${WebsiteOS0} Web App`, async () => {
        let createdApp: WebSiteManagementModels.Site;
        createdApp = await webSiteClient.webApps.get(resourceName, resourceName);
        assert.equal(createdApp.state, 'Running', `Web App state should be 'Running' rather than ${createdApp.state} before restart.`);
        await testUserInput.runWithInputs([resourceName], async () => {
            await vscode.commands.executeCommand('appService.Restart');
        });
        createdApp = await webSiteClient.webApps.get(resourceName, resourceName);
        assert.equal(createdApp.state, 'Running', `Web App state should be 'Running' rather than ${createdApp.state}.`);
    });

    test(`Configure Deployment Source to LocalGit for ${WebsiteOS0} Web App`, async () => {
        let createdApp: WebSiteManagementModels.SiteConfigResource = await webSiteClient.webApps.getConfiguration(resourceName, resourceName);
        assert.notEqual(createdApp.scmType, constants.ScmType.LocalGit, `Web App scmType's property value shouldn't be ${createdApp.scmType} before "Configure Deployment Source to LocalGit".`);
        await testUserInput.runWithInputs([resourceName, constants.ScmType.LocalGit], async () => {
            await vscode.commands.executeCommand('appService.ConfigureDeploymentSource');
        });
        createdApp = await webSiteClient.webApps.getConfiguration(resourceName, resourceName);
        assert.equal(createdApp.scmType, constants.ScmType.LocalGit, `Web App scmType's property value should be ${constants.ScmType.LocalGit} rather than ${createdApp.scmType}.`);
    });

    test(`Configure Deployment Source to None for ${WebsiteOS0} Web App`, async () => {
        let createdApp: WebSiteManagementModels.SiteConfigResource = await webSiteClient.webApps.getConfiguration(resourceName, resourceName);
        assert.notEqual(createdApp.scmType, constants.ScmType.None, `Web App scmType's property value shouldn't be ${createdApp.scmType} before "Configure Deployment Source to None".`);
        await testUserInput.runWithInputs([resourceName, constants.ScmType.None], async () => {
            await vscode.commands.executeCommand('appService.ConfigureDeploymentSource');
        });
        createdApp = await webSiteClient.webApps.getConfiguration(resourceName, resourceName);
        assert.equal(createdApp.scmType, constants.ScmType.None, `Web App scmType's property value should be ${constants.ScmType.None} rather than ${createdApp.scmType}.`);
    });

    test(`Add new setting for ${WebsiteOS0} Web App`, async () => {
        const createdApp: WebSiteManagementModels.Site = await webSiteClient.webApps.get(resourceName, resourceName);
        assert.ok(createdApp);
        await testUserInput.runWithInputs([resourceName, appSettingKey, appSettingValue], async () => {
            await vscode.commands.executeCommand('appService.appSettings.Add');
        });
        assert.equal(await getAppSettingValue(resourceName, resourceName, appSettingKey), appSettingValue);
    });

    test(`Delete Web App for ${WebsiteOS0} Web App`, async () => {
        const createdApp: WebSiteManagementModels.Site = await webSiteClient.webApps.get(resourceName, resourceName);
        assert.ok(createdApp);
        await testUserInput.runWithInputs([resourceName, DialogResponses.deleteResponse.title, DialogResponses.yes.title], async () => {
            await vscode.commands.executeCommand('appService.Delete');
        });
        const deletedApp: WebSiteManagementModels.Site | undefined = await webSiteClient.webApps.get(resourceName, resourceName);
        assert.ifError(deletedApp); // if app was deleted, get() returns null.  assert.ifError throws if the value passed is not null/undefined
    });

    async function getAppSettingValue(resourceGroupName: string, webAppName: string, key: string): Promise<string | undefined> {
        let value: string | undefined;
        const listAppSettings: WebSiteManagementModels.StringDictionary = await webSiteClient.webApps.listApplicationSettings(resourceGroupName, webAppName);
        if (listAppSettings.properties) {
            value = listAppSettings.properties[key];
        }
        return value;
    }

    async function getInput(inputOS: WebsiteOS): Promise<(string | RegExp)[]> {
        const regExpLTS: RegExp = /LTS/g;
        const webAppOS: string | RegExp = inputOS.charAt(0).toUpperCase() + inputOS.slice(1);
        if (inputOS.toLowerCase() === WebsiteOS.linux) {
            return [webAppOS, regExpLTS];
        }
        return [webAppOS];
    }
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from '@azure/arm-appservice';
import * as assert from 'assert';
import { tryGetWebApp, WebsiteOS } from 'vscode-azureappservice';
import { runWithTestActionContext } from 'vscode-azureextensiondev';
import { addAppSetting, constants, createWebAppAdvanced, deleteAppSetting, deleteWebApp, DialogResponses, editScmType, getRandomHexString } from '../../extension.bundle';
import { longRunningTestsEnabled } from '../global.test';
import { getRotatingLocation, getRotatingPricingTier } from './getRotatingValue';
import { resourceGroupsToDelete, webSiteClient } from './global.resource.test';

suite('Web App actions', function (this: Mocha.Suite): void {
    this.timeout(6 * 60 * 1000);
    let resourceName: string;
    const WebsiteOS0: WebsiteOS = (new Date().getDate()) % 2 === 0 ? WebsiteOS.linux : WebsiteOS.windows;
    const WebsiteOS1: WebsiteOS = WebsiteOS0 === WebsiteOS.windows ? WebsiteOS.linux : WebsiteOS.windows;

    suiteSetup(function (this: Mocha.Context): void {
        if (!longRunningTestsEnabled) {
            this.skip();
        }
        resourceName = getRandomHexString();
    });

    test(`Create New ${WebsiteOS0} Web App (Advanced)`, async () => {
        const testInputs: (string | RegExp)[] = [resourceName, '$(plus) Create new resource group', resourceName, ...getInput(WebsiteOS0), getRotatingLocation(), '$(plus) Create new App Service plan', resourceName, getRotatingPricingTier(), '$(plus) Create new Application Insights resource', resourceName];
        resourceGroupsToDelete.push(resourceName);
        await runWithTestActionContext('CreateWebAppAdvanced', async context => {
            await context.ui.runWithInputs(testInputs, async () => {
                await createWebAppAdvanced(context);
            });
        });
        const createdApp: WebSiteManagementModels.Site | undefined = await tryGetWebApp(webSiteClient, resourceName, resourceName);
        assert.ok(createdApp);
    });

    test(`Create New ${WebsiteOS1} Web App (Advanced)`, async () => {
        const resourceGroupName: string = getRandomHexString();
        const webAppName: string = getRandomHexString();
        const appServicePlanName: string = getRandomHexString();
        const applicationInsightsName: string = getRandomHexString();
        resourceGroupsToDelete.push(resourceGroupName);
        const testInputs: (string | RegExp)[] = [webAppName, '$(plus) Create new resource group', resourceGroupName, ...getInput(WebsiteOS1), getRotatingLocation(), '$(plus) Create new App Service plan', appServicePlanName, getRotatingPricingTier(), '$(plus) Create new Application Insights resource', applicationInsightsName];
        await runWithTestActionContext('CreateWebAppAdvanced', async context => {
            await context.ui.runWithInputs(testInputs, async () => {
                await createWebAppAdvanced(context);
            });
        });
        const createdApp: WebSiteManagementModels.Site | undefined = await tryGetWebApp(webSiteClient, resourceGroupName, webAppName);
        assert.ok(createdApp);
    });

    test(`Configure Deployment Source to LocalGit for ${WebsiteOS0} Web App`, async () => {
        let createdApp: WebSiteManagementModels.SiteConfigResource = await webSiteClient.webApps.getConfiguration(resourceName, resourceName);
        assert.notStrictEqual(createdApp?.scmType, constants.ScmType.LocalGit, `Web App scmType's property value shouldn't be ${createdApp?.scmType} before "Configure Deployment Source to LocalGit".`);
        await runWithTestActionContext('ConfigureDeploymentSource', async context => {
            await context.ui.runWithInputs([resourceName, constants.ScmType.LocalGit], async () => {
                await editScmType(context);
            });
        });
        createdApp = await webSiteClient.webApps.getConfiguration(resourceName, resourceName);
        assert.strictEqual(createdApp?.scmType, constants.ScmType.LocalGit, `Web App scmType's property value should be ${constants.ScmType.LocalGit} rather than ${createdApp?.scmType}.`);
    });

    test(`Configure Deployment Source to None for ${WebsiteOS0} Web App`, async () => {
        let createdApp: WebSiteManagementModels.SiteConfigResource = await webSiteClient.webApps.getConfiguration(resourceName, resourceName);
        assert.notStrictEqual(createdApp?.scmType, constants.ScmType.None, `Web App scmType's property value shouldn't be ${createdApp?.scmType} before "Configure Deployment Source to None".`);
        await runWithTestActionContext('ConfigureDeploymentSource', async context => {
            await context.ui.runWithInputs([resourceName, constants.ScmType.None], async () => {
                await editScmType(context);
            });
        });
        createdApp = await webSiteClient.webApps.getConfiguration(resourceName, resourceName);
        assert.strictEqual(createdApp?.scmType, constants.ScmType.None, `Web App scmType's property value should be ${constants.ScmType.None} rather than ${createdApp?.scmType}.`);
    });

    test(`Add and delete settings for ${WebsiteOS0} Web App`, async () => {
        const appSettingKey: string = getRandomHexString();
        const appSettingValue: string = getRandomHexString();
        const createdApp: WebSiteManagementModels.Site | undefined = await tryGetWebApp(webSiteClient, resourceName, resourceName);
        assert.ok(createdApp);
        await runWithTestActionContext('appSettings.Add', async context => {
            await context.ui.runWithInputs([resourceName, appSettingKey, appSettingValue], async () => {
                await addAppSetting(context);
            });
        });
        assert.strictEqual(await getAppSettingValue(resourceName, resourceName, appSettingKey), appSettingValue, `Fail to add setting "${appSettingKey}"`);
        await runWithTestActionContext('appSettings.Delete', async context => {
            await context.ui.runWithInputs([resourceName, `${appSettingKey}=Hidden value. Click to view.`, DialogResponses.deleteResponse.title], async () => {
                await deleteAppSetting(context);
            });
        });
        assert.ifError(await getAppSettingValue(resourceName, resourceName, appSettingKey));
    });

    test(`Delete Web App for ${WebsiteOS0} Web App`, async () => {
        const createdApp: WebSiteManagementModels.Site | undefined = await tryGetWebApp(webSiteClient, resourceName, resourceName);
        assert.ok(createdApp);
        await runWithTestActionContext('Delete', async context => {
            await context.ui.runWithInputs([resourceName, DialogResponses.deleteResponse.title, DialogResponses.yes.title], async () => {
                await deleteWebApp(context);
            });
        });
        const deletedApp: WebSiteManagementModels.Site | undefined = await tryGetWebApp(webSiteClient, resourceName, resourceName);
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

    function getInput(inputOS: WebsiteOS): (string | RegExp)[] {
        const runtime: RegExp = /NET.*LTS/gi;
        const webAppOS: string = inputOS.charAt(0).toUpperCase() + inputOS.slice(1);
        return [runtime, webAppOS];
    }
});

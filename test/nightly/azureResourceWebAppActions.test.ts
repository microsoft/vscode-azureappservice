/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type Site, type SiteConfigResource, type StringDictionary } from '@azure/arm-appservice';
import { WebsiteOS, tryGetWebApp } from '@microsoft/vscode-azext-azureappservice';
import { DialogResponses, runWithTestActionContext } from '@microsoft/vscode-azext-utils';
import * as assert from 'assert';
import { ScmType } from '../../src/constants';
import { delay } from '../../src/utils/delay';
import { getRandomHexString } from '../../src/utils/randomUtils';
import { longRunningTestsEnabled, testSubscription, webSiteClient } from '../global.test';
import { getCachedTestApi } from '../utils/testApiAccess';
import { resourceGroupsToDelete } from './aaa_global.resource.test';
import { getRotatingPricingTier } from './getRotatingValue';

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
        const testInputs: (string | RegExp)[] = ['West US 3', 'Secure unique default hostname', '$(plus) Create new resource group', resourceName, resourceName, ...getInput(WebsiteOS0), '$(plus) Create new App Service plan', resourceName, getRotatingPricingTier(), '$(plus) Create new Application Insights resource', resourceName];
        resourceGroupsToDelete.push(resourceName);
        const testApi = getCachedTestApi();
        await runWithTestActionContext('CreateWebAppAdvanced', async context => {
            await context.ui.runWithInputs(testInputs, async () => {
                await testApi.commands.createWebAppAdvanced(context, testSubscription);
            });
        });
        // Retry up to 5 times over ~1 minute to allow the app time to finish provisioning.
        const maxAttempts = 5;
        const delayMs = 15_000;
        let createdApp: Site | undefined;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            createdApp = await tryGetWebApp(webSiteClient, resourceName, resourceName);
            if (createdApp) {
                break;
            }
            if (attempt < maxAttempts) {
                await delay(delayMs);
            }
        }
        assert.ok(createdApp);
    });

    test(`Create New ${WebsiteOS1} Web App (Advanced)`, async () => {
        const resourceGroupName: string = getRandomHexString();
        const webAppName: string = getRandomHexString();
        const appServicePlanName: string = getRandomHexString();
        const applicationInsightsName: string = getRandomHexString();
        resourceGroupsToDelete.push(resourceGroupName);
        const testInputs: (string | RegExp)[] = ['West US 3', 'Secure unique default hostname', '$(plus) Create new resource group', resourceGroupName, resourceGroupName, ...getInput(WebsiteOS1), '$(plus) Create new App Service plan', appServicePlanName, getRotatingPricingTier(), '$(plus) Create new Application Insights resource', applicationInsightsName];
        const testApi = getCachedTestApi();
        await runWithTestActionContext('CreateWebAppAdvanced', async context => {
            await context.ui.runWithInputs(testInputs, async () => {
                await testApi.commands.createWebAppAdvanced(context, testSubscription);
            });
        });
        // Retry up to 5 times over ~1 minute to allow the app time to finish provisioning.
        const maxAttempts = 5;
        const delayMs = 15_000;
        let createdApp: Site | undefined;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            createdApp = await tryGetWebApp(webSiteClient, resourceGroupName, webAppName);
            if (createdApp) {
                break;
            }
            if (attempt < maxAttempts) {
                await delay(delayMs);
            }
        }
        assert.ok(createdApp);
    });

    test(`Configure Deployment Source to LocalGit for ${WebsiteOS0} Web App`, async () => {
        let createdApp: SiteConfigResource = await webSiteClient.webApps.getConfiguration(resourceName, resourceName);
        assert.notStrictEqual(createdApp?.scmType, ScmType.LocalGit, `Web App scmType's property value shouldn't be ${createdApp?.scmType} before "Configure Deployment Source to LocalGit".`);
        const testApi = getCachedTestApi();
        await runWithTestActionContext('ConfigureDeploymentSource', async context => {
            await context.ui.runWithInputs([resourceName, ScmType.LocalGit], async () => {
                await testApi.commands.editScmType(context);
            });
        });
        createdApp = await webSiteClient.webApps.getConfiguration(resourceName, resourceName);
        assert.strictEqual(createdApp?.scmType, ScmType.LocalGit, `Web App scmType's property value should be ${ScmType.LocalGit} rather than ${createdApp?.scmType}.`);
    });

    test(`Configure Deployment Source to None for ${WebsiteOS0} Web App`, async () => {
        let createdApp: SiteConfigResource = await webSiteClient.webApps.getConfiguration(resourceName, resourceName);
        assert.notStrictEqual(createdApp?.scmType, ScmType.None, `Web App scmType's property value shouldn't be ${createdApp?.scmType} before "Configure Deployment Source to None".`);
        const testApi = getCachedTestApi();
        await runWithTestActionContext('ConfigureDeploymentSource', async context => {
            await context.ui.runWithInputs([resourceName, ScmType.None], async () => {
                await testApi.commands.editScmType(context);
            });
        });
        createdApp = await webSiteClient.webApps.getConfiguration(resourceName, resourceName);
        assert.strictEqual(createdApp?.scmType, ScmType.None, `Web App scmType's property value should be ${ScmType.None} rather than ${createdApp?.scmType}.`);
    });

    test(`Add and delete settings for ${WebsiteOS0} Web App`, async () => {
        const appSettingKey: string = getRandomHexString();
        const appSettingValue: string = getRandomHexString();
        const createdApp: Site | undefined = await tryGetWebApp(webSiteClient, resourceName, resourceName);
        assert.ok(createdApp);
        const testApi = getCachedTestApi();
        await runWithTestActionContext('appSettings.Add', async context => {
            await context.ui.runWithInputs([resourceName, appSettingKey, appSettingValue], async () => {
                await testApi.commands.addAppSetting(context);
            });
        });
        assert.strictEqual(await getAppSettingValue(resourceName, resourceName, appSettingKey), appSettingValue, `Fail to add setting "${appSettingKey}"`);
        await runWithTestActionContext('appSettings.Delete', async context => {
            await context.ui.runWithInputs([resourceName, `${appSettingKey}=Hidden value. Click to view.`, DialogResponses.deleteResponse.title], async () => {
                await testApi.commands.deleteAppSetting(context);
            });
        });
        assert.ifError(await getAppSettingValue(resourceName, resourceName, appSettingKey));
    });

    test(`Delete Web App for ${WebsiteOS0} Web App`, async () => {
        const createdApp: Site | undefined = await tryGetWebApp(webSiteClient, resourceName, resourceName);
        assert.ok(createdApp);
        const testApi = getCachedTestApi();
        await runWithTestActionContext('Delete', async context => {
            await context.ui.runWithInputs([resourceName, DialogResponses.deleteResponse.title, DialogResponses.yes.title], async () => {
                await testApi.commands.deleteWebApp(context);
            });
        });
        const deletedApp: Site | undefined = await tryGetWebApp(webSiteClient, resourceName, resourceName);
        assert.ifError(deletedApp); // if app was deleted, get() returns null.  assert.ifError throws if the value passed is not null/undefined
    });

    async function getAppSettingValue(resourceGroupName: string, webAppName: string, key: string): Promise<string | undefined> {
        let value: string | undefined;
        const listAppSettings: StringDictionary = await webSiteClient.webApps.listApplicationSettings(resourceGroupName, webAppName);
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

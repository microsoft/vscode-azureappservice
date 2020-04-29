/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { WebSiteManagementModels as Models } from 'azure-arm-website';
import { IHookCallbackContext, ISuiteCallbackContext } from 'mocha';
import * as vscode from 'vscode';
import { getRandomHexString } from '../../extension.bundle';
import { longRunningTestsEnabled, testUserInput } from '../global.test';
import { resourceGroupsToDelete, webSiteClient } from './global.resource.test';

suite('Application settings', async function (this: ISuiteCallbackContext): Promise<void> {
    this.timeout(5 * 60 * 1000);
    let resourceName: string;
    let appSettingKey: string;
    let appSettingValue: string;

    suiteSetup(async function (this: IHookCallbackContext): Promise<void> {
        if (!longRunningTestsEnabled) {
            this.skip();
        }
        resourceName = getRandomHexString();
        appSettingKey = getRandomHexString();
        appSettingValue = getRandomHexString();
        resourceGroupsToDelete.push(resourceName);
    });

    test('Add new setting', async () => {
        const regExpLTS: RegExp = /LTS/g;
        const testInputs: (string | RegExp)[] = [resourceName, '$(plus) Create new resource group', resourceName, 'Linux', regExpLTS, '$(plus) Create new App Service plan', resourceName, 'B1', '$(plus) Create new Application Insights resource', resourceName, 'East US'];
        await testUserInput.runWithInputs(testInputs, async () => {
            await vscode.commands.executeCommand('appService.CreateWebAppAdvanced');
        });
        const createdApp: Models.Site = await webSiteClient.webApps.get(resourceName, resourceName);
        assert.ok(createdApp);

        // Add new setting
        await testUserInput.runWithInputs([resourceName, appSettingKey, appSettingValue], async () => {
            await vscode.commands.executeCommand('appService.appSettings.Add');
        });
        assert.equal(await getAppSettingValue(resourceName, resourceName, appSettingKey), appSettingValue);
    });

    async function getAppSettingValue(resourceGroupName: string, webAppName: string, key: string): Promise<string | undefined> {
        let value: string | undefined;
        const listAppSettings: Models.StringDictionary = await webSiteClient.webApps.listApplicationSettings(resourceGroupName, webAppName);
        if (listAppSettings.properties) {
            value = listAppSettings.properties[key];
        }
        return value;
    }
});

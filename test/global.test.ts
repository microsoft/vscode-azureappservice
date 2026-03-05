/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerAppServiceExtensionVariables } from '@microsoft/vscode-azext-azureappservice';
import { registerOnActionStartHandler, testGlobalSetup, TestUserInput } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { ext, registerExtensionVariables, type IAppServiceExtensionVariables } from '../src/extensionVariables';
import { getResourceGroupsApi } from '../src/utils/getExtensionApi';

const longRunningLocalTestsEnabled: boolean = !/^(false|0)?$/i.test(process.env.AzCode_EnableLongRunningTestsLocal || '');
const longRunningRemoteTestsEnabled: boolean = !/^(false|0)?$/i.test(process.env.AzCode_UseAzureFederatedCredentials || '');

export const longRunningTestsEnabled: boolean = longRunningLocalTestsEnabled || longRunningRemoteTestsEnabled;

// Runs before all tests
suiteSetup(async function (this: Mocha.Context): Promise<void> {
    this.timeout(120 * 1000);

    // Initialize extension variables using testGlobalSetup pattern
    const baseVars = testGlobalSetup();
    const extVars: IAppServiceExtensionVariables = {
        ...baseVars,
        prefix: 'appService',
    } as IAppServiceExtensionVariables;

    registerExtensionVariables(extVars);
    registerAppServiceExtensionVariables(ext);

    // For nightly tests, we need the Azure Resource Groups API
    if (longRunningTestsEnabled) {
        try {
            ext.rgApi = await getResourceGroupsApi();
        } catch (error) {
            console.warn('Failed to get Resource Groups API:', error);
            // Tests that need rgApi will fail, but unit tests can continue
        }
    }

    registerOnActionStartHandler(context => {
        // Use `TestUserInput` by default so we get an error if an unexpected call to `context.ui` occurs, rather than timing out
        context.ui = new TestUserInput(vscode);
    });
});

export { ext };

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerAzureUtilsExtensionVariables } from '@microsoft/vscode-azext-azureutils';
import { TestOutputChannel, TestUserInput } from '@microsoft/vscode-azext-dev';
import * as vscode from 'vscode';
import { ext, registerOnActionStartHandler, registerUIExtensionVariables } from '../extension.bundle';

export const longRunningTestsEnabled: boolean = !/^(false|0)?$/i.test(process.env.AzCode_UseAzureFederatedCredentials || '');

// Runs before all tests
suiteSetup(async function (this: Mocha.Context): Promise<void> {
    this.timeout(120 * 1000);
    await vscode.commands.executeCommand('appService.Refresh'); // activate the extension before tests begin

    ext.outputChannel = new TestOutputChannel();
    registerUIExtensionVariables(ext);
    registerAzureUtilsExtensionVariables(ext);

    registerOnActionStartHandler(context => {
        // Use `TestUserInput` by default so we get an error if an unexpected call to `context.ui` occurs, rather than timing out
        context.ui = new TestUserInput(vscode);
    });
});

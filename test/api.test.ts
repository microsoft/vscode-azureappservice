/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ISuiteCallbackContext } from 'mocha';
import * as vscode from 'vscode';
import { AzureExtensionApiProvider } from 'vscode-azureextensionui/api';
import { AzureAppServiceExtensionApi } from '../extension.bundle';

suite('Public API', async function (this: ISuiteCallbackContext): Promise<void> {
    this.timeout(1200 * 1000);
    let appServiceApi: AzureAppServiceExtensionApi;

    suiteSetup(async (): Promise<void> => {
        const appServiceExtension: vscode.Extension<AzureExtensionApiProvider | undefined> | undefined = vscode.extensions.getExtension('ms-azuretools.vscode-azureappservice');
        if (!appServiceExtension || !appServiceExtension.exports) {
            throw new Error('App Service Extension did not load properly.');
        }

        appServiceApi = appServiceExtension.exports.getApi<AzureAppServiceExtensionApi>('^1.0.0');
    });

    test('Deploy command loaded properly', () => {
        assert.ok(appServiceApi.deploy);
    });

});

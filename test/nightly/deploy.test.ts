/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { WebSiteManagementModels } from 'azure-arm-website';
import { IHookCallbackContext, ISuiteCallbackContext } from 'mocha';
import * as path from 'path';
import * as vscode from 'vscode';
import { DialogResponses, getRandomHexString, requestUtils } from '../../extension.bundle';
import { longRunningTestsEnabled, testUserInput } from '../global.test';
import { resourceGroupsToDelete, webSiteClient } from './global.resource.test';

suite('Create Web App and deploy', async function (this: ISuiteCallbackContext): Promise<void> {
    this.timeout(20 * 6 * 1000);

    suiteSetup(async function (this: IHookCallbackContext): Promise<void> {
        if (!longRunningTestsEnabled) {
            this.skip();
        }
    });

    test('Node LTS', async () => {
        const testFolderPath: string = await getWorkspacePath('nodejs-docs-hello-world');
        await testCreateWebAppAndDeploy(['Linux', 'Node LTS'], testFolderPath);
    });

    async function testCreateWebAppAndDeploy(options: string[], workspacePath: string): Promise<void> {
        const resourceName: string = getRandomHexString();
        const resourceGroupName: string = getRandomHexString();
        resourceGroupsToDelete.push(resourceGroupName);
        const testInputs: (string | RegExp)[] = [resourceName, '$(plus) Create new resource group', resourceGroupName, ...options, '$(plus) Create new App Service plan', resourceName, 'B1', '$(plus) Create new Application Insights resource', resourceName, 'West US'];
        await testUserInput.runWithInputs(testInputs, async () => {
            await vscode.commands.executeCommand('appService.CreateWebAppAdvanced');
        });
        const createdApp: WebSiteManagementModels.Site = await webSiteClient.webApps.get(resourceGroupName, resourceName);
        assert.ok(createdApp);

        // Verify that the deployment is successful
        await testUserInput.runWithInputs([workspacePath, resourceName, 'Deploy', DialogResponses.yes.title], async () => {
            await vscode.commands.executeCommand('appService.Deploy');
        });
        const request: requestUtils.Request = await requestUtils.getDefaultRequest(`https://${resourceName}.azurewebsites.net`);
        request.json = true;
        const response: string = await requestUtils.sendRequest(request);
        assert.ok(response.includes('Hello World'), 'Expected function response to include "Hello World"');
    }
});

// The workspace folder that vscode is opened against for tests
async function getWorkspacePath(testWorkspaceName: string): Promise<string> {
    let workspacePath: string = '';
    const workspaceFolders: vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error("No workspace is open");
    } else {
        assert.equal(workspaceFolders.length, 1, "Expected three workspace to be open.");
        for (const obj of workspaceFolders) {
            if (obj.name === testWorkspaceName) {
                workspacePath = obj.uri.fsPath;
            }
        }
    }
    assert.equal(path.basename(workspacePath), testWorkspaceName, "Opened against an unexpected workspace.");
    return workspacePath;
}

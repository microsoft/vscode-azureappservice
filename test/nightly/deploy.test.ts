/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from '@azure/arm-appservice';
import { HttpOperationResponse, ServiceClient } from '@azure/ms-rest-js';
import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { tryGetWebApp } from 'vscode-azureappservice';
import { createGenericClient, DialogResponses, ext, getRandomHexString, IActionContext, WebAppTreeItem } from '../../extension.bundle';
import { longRunningTestsEnabled, testUserInput } from '../global.test';
import { beginDeleteResourceGroup, webSiteClient } from './global.resource.test';

interface ITestCase {
    workspaceFolder: string;
    runtimes: string[];
}

suite('Create Web App and deploy', async function (this: Mocha.Suite): Promise<void> {
    this.timeout(12 * 60 * 1000);
    let resourceGroupName: string = '';
    const testCases: ITestCase[] = [
        { workspaceFolder: 'nodejs-docs-hello-world', runtimes: ['Node 10 LTS', 'Node 12 LTS', 'Node 14 LTS'] },
        { workspaceFolder: '2.1', runtimes: ['.NET Core 2.1'] },
        { workspaceFolder: '3.1', runtimes: ['.NET Core 3.1'] },
        { workspaceFolder: 'python-docs-hello-world', runtimes: ['Python 3.6', 'Python 3.7', 'Python 3.8'] }
    ];

    suiteSetup(async function (this: Mocha.Context): Promise<void> {
        if (!longRunningTestsEnabled) {
            this.skip();
        }
    });

    teardown(async function (this: Mocha.Context): Promise<void> {
        if (longRunningTestsEnabled) {
            this.timeout(2 * 60 * 1000);
            await beginDeleteResourceGroup(resourceGroupName);
            resourceGroupName = '';
        }
    });

    for (const testCase of testCases) {
        for (const runtime of testCase.runtimes) {
            test(runtime, async () => {
                const testFolderPath: string = await getWorkspacePath(testCase.workspaceFolder);
                await testCreateWebAppAndDeploy(['Linux', runtime], testFolderPath);
            });
        }
    }

    async function testCreateWebAppAndDeploy(options: string[], workspacePath: string): Promise<void> {
        const resourceName: string = getRandomHexString();
        resourceGroupName = getRandomHexString();
        const context: IActionContext = { telemetry: { properties: {}, measurements: {} }, errorHandling: { issueProperties: {} } };
        const testInputs: (string | RegExp)[] = [resourceName, '$(plus) Create new resource group', resourceGroupName, ...options, '$(plus) Create new App Service plan', resourceName, 'S1', '$(plus) Create new Application Insights resource', resourceName, 'West US'];
        await testUserInput.runWithInputs(testInputs, async () => {
            await vscode.commands.executeCommand('appService.CreateWebAppAdvanced');
        });
        const createdApp: WebSiteManagementModels.Site | undefined = await tryGetWebApp(webSiteClient, resourceGroupName, resourceName);
        assert.ok(createdApp);

        // Verify that the deployment is successful
        await testUserInput.runWithInputs([workspacePath, resourceName, 'Deploy', DialogResponses.skipForNow.title], async () => {
            await vscode.commands.executeCommand('appService.Deploy');
        });
        const hostUrl: string | undefined = (<WebAppTreeItem>await ext.tree.findTreeItem(<string>createdApp?.id, context)).root.client.defaultHostUrl;
        const client: ServiceClient = await createGenericClient();
        const response: HttpOperationResponse = await client.sendRequest({ method: 'GET', url: hostUrl });
        assert.strictEqual(response.bodyAsText, 'Hello World!');
    }
});

// The workspace folder that vscode is opened against for tests
async function getWorkspacePath(testWorkspaceName: string): Promise<string> {
    let workspacePath: string = '';
    const workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error("No workspace is open");
    } else {
        for (const obj of workspaceFolders) {
            if (obj.name === testWorkspaceName) {
                workspacePath = obj.uri.fsPath;
            }
        }
        assert.equal(path.basename(workspacePath), testWorkspaceName, "Opened against an unexpected workspace.");
        return workspacePath;
    }
}

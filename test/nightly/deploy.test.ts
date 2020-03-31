/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { WebSiteManagementModels } from 'azure-arm-website';
import * as path from 'path';
import * as vscode from 'vscode';
import { DialogResponses, ext, getRandomHexString, IActionContext, requestUtils, WebAppTreeItem } from '../../extension.bundle';
import { longRunningTestsEnabled, testUserInput } from '../global.test';
import { resourceGroupsToDelete, webSiteClient } from './global.resource.test';

suite('Create Web App and deploy', async function (this: Mocha.Suite): Promise<void> {
    this.timeout(5 * 60 * 1000);

    suiteSetup(async function (this: Mocha.Context): Promise<void> {
        if (!longRunningTestsEnabled) {
            this.skip();
        }
    });

    test('Node LTS', async () => {
        const testFolderPath: string = await getWorkspacePath('nodejs-docs-hello-world');
        await testCreateWebAppAndDeploy(['Linux', 'Node LTS'], testFolderPath);
    });

    test('Node 8 LTS', async () => {
        const testFolderPath: string = await getWorkspacePath('nodejs-docs-hello-world');
        await testCreateWebAppAndDeploy(['Linux', 'Node 8 LTS'], testFolderPath);
    });

    test('Node 10 LTS', async () => {
        const testFolderPath: string = await getWorkspacePath('nodejs-docs-hello-world');
        await testCreateWebAppAndDeploy(['Linux', 'Node 10 LTS'], testFolderPath);
    });

    test('Node 12 LTS', async () => {
        const testFolderPath: string = await getWorkspacePath('nodejs-docs-hello-world');
        await testCreateWebAppAndDeploy(['Linux', 'Node 12 LTS'], testFolderPath);
    });

    async function testCreateWebAppAndDeploy(options: string[], workspacePath: string): Promise<void> {
        const resourceName: string = getRandomHexString();
        const resourceGroupName: string = getRandomHexString();
        resourceGroupsToDelete.push(resourceGroupName);
        const context: IActionContext = { telemetry: { properties: {}, measurements: {} }, errorHandling: { issueProperties: {} } };
        const testInputs: (string | RegExp)[] = [resourceName, '$(plus) Create new resource group', resourceGroupName, ...options, '$(plus) Create new App Service plan', resourceName, 'B1', '$(plus) Create new Application Insights resource', resourceName, 'West US'];
        await testUserInput.runWithInputs(testInputs, async () => {
            await vscode.commands.executeCommand('appService.CreateWebAppAdvanced');
        });
        const createdApp: WebSiteManagementModels.Site = await webSiteClient.webApps.get(resourceGroupName, resourceName);
        assert.ok(createdApp);

        // Verify that the deployment is successful
        await testUserInput.runWithInputs([workspacePath, resourceName, 'Deploy', DialogResponses.skipForNow.title], async () => {
            await vscode.commands.executeCommand('appService.Deploy');
        });
        const hostUrl: string | undefined = (<WebAppTreeItem>await ext.tree.findTreeItem(<string>createdApp.id, context)).root.client.defaultHostUrl;
        const request: requestUtils.Request = await requestUtils.getDefaultRequest(hostUrl);
        request.json = true;
        const response: string = await requestUtils.sendRequest(request);
        assert.ok(response.includes('Hello World'), 'Expected function response to include "Hello World"');
    }
});

// The workspace folder that vscode is opened against for tests
async function getWorkspacePath(testWorkspaceName: string): Promise<string> {
    const workspaceFolders: vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error("No workspace is open");
    } else {
        const workspacePath: string = workspaceFolders[0].uri.fsPath;
        assert.equal(path.basename(workspacePath), testWorkspaceName, "Opened against an unexpected workspace.");
        return workspacePath;
    }
}

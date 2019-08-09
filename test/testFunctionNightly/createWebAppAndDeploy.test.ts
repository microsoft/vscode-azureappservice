/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { WebSiteManagementModels } from 'azure-arm-website';
import * as fse from 'fs-extra';
import { IHookCallbackContext, ISuiteCallbackContext } from 'mocha';
import * as path from 'path';
import * as request from 'request-promise';
import * as vscode from 'vscode';
import { constants, DialogResponses, getRandomHexString, getWorkspaceSetting } from '../../extension.bundle';
import { longRunningTestsEnabled, testUserInput } from '../global.test';
import { resourceGroupsToDelete, webSiteClient } from './global.resource.test';

suite('Create Web App and deploy', async function (this: ISuiteCallbackContext): Promise<void> {
    this.timeout(350 * 1000);
    let resourceGroupName: string;

    suiteSetup(async function (this: IHookCallbackContext): Promise<void> {
        if (!longRunningTestsEnabled) {
            this.skip();
        }
        resourceGroupName = getRandomHexString();
        resourceGroupsToDelete.push(resourceGroupName);
    });

    test('Deploy folder to Linux Web App with "Nodejs LTS" runtime', async () => {
        const testFolderPath: string = await getWorkspacePath('nodejs-docs-hello-world-master');
        await testCreateWebAppAndDeploy(['$(plus) Create new resource group', resourceGroupName], ['Linux', /LTS/g], testFolderPath);
    });

    test('Deploy .zip files to Linux Web App with "Nodejs LTS" runtime', async () => {
        const testFolderPath: string = await getWorkspacePath('nodejs-docs-hello-world-master.zip');
        await testCreateWebAppAndDeploy([resourceGroupName], ['Linux', /LTS/g], testFolderPath);
    });

    async function testCreateWebAppAndDeploy(resourceGroupInputs: string[], OSInputs: (string | RegExp)[], workspacePath: string): Promise<void> {
        const webAppName: string = getRandomHexString();
        const appServicePlan: string = getRandomHexString();
        const testInputs: (string | RegExp)[] = [webAppName, ...resourceGroupInputs, ...OSInputs, '$(plus) Create new App Service plan', appServicePlan, 'B1', 'West US'];
        await testUserInput.runWithInputs(testInputs, async () => {
            await vscode.commands.executeCommand('appService.CreateWebAppAdvanced');
        });
        const createdApp: WebSiteManagementModels.Site = await webSiteClient.webApps.get(resourceGroupName, webAppName);
        assert.ok(createdApp);

        const testDeployinputs: (string | RegExp)[] = ['Deploy', DialogResponses.skipForNow.title];
        if (getWorkspaceSetting<boolean>(constants.configurationSettings.showBuildDuringDeployPrompt, workspacePath) && (await fse.lstat(workspacePath)).isDirectory()) {
            testDeployinputs.unshift(`No, and don't show again`);
        }
        testDeployinputs.unshift(workspacePath, webAppName);
        await testUserInput.runWithInputs(testDeployinputs, async () => {
            await vscode.commands.executeCommand('appService.Deploy');
        });

        // Verify that the deployment is successful
        await validateFunctionUrl(`https://${webAppName}.azurewebsites.net`);
    }
});

// The workspace .zip/folder that vscode is opened against for tests
async function getWorkspacePath(testWorkspaceName: string): Promise<string> {
    let workspacePath: string = '';
    const workspaceFolders: vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error("No workspace is open");
    } else {
        assert.equal(workspaceFolders.length, 2, "Expected two workspace to be open.");
        for (const obj of workspaceFolders) {
            if (obj.name === testWorkspaceName) {
                workspacePath = obj.uri.fsPath;
            }
        }
    }
    assert.equal(path.basename(workspacePath), testWorkspaceName, "Opened against an unexpected workspace.");
    return workspacePath;
}

async function validateFunctionUrl(url: string): Promise<void> {
    const options: request.Options = {
        method: 'GET',
        uri: url,
        json: true
    };
    const response: string = await <Thenable<string>>request(options).promise();
    assert.equal(response, `Hello World!`, `The result should be "Hello World!" rather than ${response}`);
}

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
import { createGenericClient, ext, getRandomHexString, IActionContext, WebAppTreeItem } from '../../extension.bundle';
import { longRunningTestsEnabled, testUserInput } from '../global.test';
import { resourceGroupsToDelete, webSiteClient } from './global.resource.test';

interface ITestCase {
    /**
     * If undefined, use the version as the folder name
     */
    workspaceFolder: string | undefined;
    runtimePrefix: string;
    versions: IVersionInfo[];
}

interface IVersionInfo {
    version: string;
    displayText?: string;
    supportedAppOs: 'Windows' | 'Linux' | 'Both';
    appOsToSkip?: 'Windows' | 'Linux';
    buildMachineOsToSkip?: NodeJS.Platform;
}

suite('Create Web App and deploy', async function (this: Mocha.Suite): Promise<void> {
    this.timeout(6 * 60 * 1000);
    const planNames: { [os: string]: string } = {};
    const testCases: ITestCase[] = [
        {
            runtimePrefix: 'Node',
            workspaceFolder: 'nodejs-docs-hello-world',
            versions: [
                { version: '10', supportedAppOs: 'Linux', displayText: '10 LTS' },
                { version: '12', supportedAppOs: 'Both', displayText: '12 LTS' },
                { version: '14', supportedAppOs: 'Linux', displayText: '14 LTS' }
            ]
        },
        {
            runtimePrefix: '.NET',
            workspaceFolder: undefined,
            versions: [
                { version: '2.1', supportedAppOs: 'Both', displayText: 'Core 2.1 (LTS)' },
                { version: '3.1', supportedAppOs: 'Both', displayText: 'Core 3.1 (LTS)' },
                { version: '5.0', supportedAppOs: 'Both', displayText: '5', buildMachineOsToSkip: 'darwin' } // Not sure why this fails on mac build machines - worth investigating in the future
            ]
        },
        {
            runtimePrefix: 'Python',
            workspaceFolder: 'python-docs-hello-world',
            versions: [
                { version: '3.6', supportedAppOs: 'Both', appOsToSkip: 'Windows' }, // Python on Windows has been deprecated for a while now, so not worth testing
                { version: '3.7', supportedAppOs: 'Linux' },
                { version: '3.8', supportedAppOs: 'Linux' }
            ]
        }
    ];

    suiteSetup(async function (this: Mocha.Context): Promise<void> {
        if (!longRunningTestsEnabled) {
            this.skip();
        }
    });

    for (const testCase of testCases) {
        for (const version of testCase.versions) {
            // tslint:disable-next-line: strict-boolean-expressions
            const runtime: string = `${testCase.runtimePrefix} ${version.displayText || version.version}`;
            const promptForOs: boolean = version.supportedAppOs === 'Both';
            const oss: string[] = promptForOs ? ['Windows', 'Linux'] : [version.supportedAppOs];
            for (const os of oss) {
                test(`${runtime} - ${os}`, async function (this: Mocha.Context): Promise<void> {
                    if (version.appOsToSkip === os || version.buildMachineOsToSkip === process.platform) {
                        this.skip();
                    }

                    const testFolderPath: string = await getWorkspacePath(testCase.workspaceFolder || version.version);
                    await testCreateWebAppAndDeploy(os, promptForOs, runtime, testFolderPath, version.version);
                });
            }
        }
    }

    async function testCreateWebAppAndDeploy(os: string, promptForOs: boolean, runtime: string, workspacePath: string, expectedVersion: string): Promise<void> {
        const resourceName: string = getRandomHexString();
        const resourceGroupName = getRandomHexString();
        resourceGroupsToDelete.push(resourceGroupName);

        const testInputs: (string | RegExp)[] = [resourceName, '$(plus) Create new resource group', resourceGroupName, runtime];
        if (promptForOs) {
            testInputs.push(os);
        }

        const appInsightsInputs: string[] = ['$(plus) Create new Application Insights resource', getRandomHexString()];
        if (planNames[os]) {
            // Re-use the same plan to save time
            testInputs.push(planNames[os], ...appInsightsInputs);
        } else {
            planNames[os] = getRandomHexString();
            testInputs.push('$(plus) Create new App Service plan', planNames[os], 'P3v2', ...appInsightsInputs, 'West US');
        }

        const context: IActionContext = { telemetry: { properties: {}, measurements: {} }, errorHandling: { issueProperties: {} } };
        await testUserInput.runWithInputs(testInputs, async () => {
            await vscode.commands.executeCommand('appService.CreateWebAppAdvanced');
        });
        const createdApp: WebSiteManagementModels.Site | undefined = await tryGetWebApp(webSiteClient, resourceGroupName, resourceName);
        assert.ok(createdApp);

        // Verify that the deployment is successful
        await testUserInput.runWithInputs([workspacePath, resourceName, 'Deploy'], async () => {
            await vscode.commands.executeCommand('appService.Deploy');
        });
        const hostUrl: string | undefined = (<WebAppTreeItem>await ext.tree.findTreeItem(<string>createdApp?.id, context)).root.client.defaultHostUrl;
        const client: ServiceClient = await createGenericClient();
        const response: HttpOperationResponse = await client.sendRequest({ method: 'GET', url: hostUrl });
        assert.strictEqual(response.bodyAsText, `Version: ${expectedVersion}`);
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

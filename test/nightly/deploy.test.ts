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
import { createTestActionContext, runWithTestActionContext } from 'vscode-azureextensiondev';
import { createGenericClient, createWebAppAdvanced, deploy, ext, getRandomHexString, nonNullProp, WebAppTreeItem } from '../../extension.bundle';
import { longRunningTestsEnabled } from '../global.test';
import { getRotatingLocation, getRotatingPricingTier } from './getRotatingValue';
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

/**
 * NOTE: We have to setup the test before suiteSetup, but we can't start the test until suiteSetup. That's why we have separate callback/task properties
 */
interface IParallelTest {
    title: string;
    task?: Promise<void>;
    callback(): Promise<void>;
}

suite('Create Web App and deploy', function (this: Mocha.Suite): void {
    this.timeout(6 * 60 * 1000);
    const testCases: ITestCase[] = [
        {
            runtimePrefix: 'Node',
            workspaceFolder: 'nodejs-docs-hello-world',
            versions: [
                { version: '12', supportedAppOs: 'Both', displayText: '12 LTS' },
                { version: '14', supportedAppOs: 'Both', displayText: '14 LTS' }
            ]
        },
        {
            runtimePrefix: '.NET',
            workspaceFolder: undefined,
            versions: [
                { version: '3.1', supportedAppOs: 'Both', displayText: 'Core 3.1 (LTS)' },
                { version: '5.0', supportedAppOs: 'Both', displayText: '5', buildMachineOsToSkip: 'darwin' }, // Not sure why this fails on mac build machines - worth investigating in the future
                { version: '6.0', supportedAppOs: 'Both', displayText: '6', buildMachineOsToSkip: 'darwin' }
            ]
        },
        {
            runtimePrefix: 'Python',
            workspaceFolder: 'python-docs-hello-world',
            versions: [
                { version: '3.6', supportedAppOs: 'Both', appOsToSkip: 'Windows' }, // Python on Windows has been deprecated for a while now, so not worth testing
                { version: '3.7', supportedAppOs: 'Linux' },
                { version: '3.8', supportedAppOs: 'Linux' },
                { version: '3.9', supportedAppOs: 'Linux' }
            ]
        }
    ];

    const parallelTests: IParallelTest[] = [];
    for (const testCase of testCases) {
        for (const version of testCase.versions) {
            const runtime: string = `${testCase.runtimePrefix} ${version.displayText || version.version}`;
            const promptForOs: boolean = version.supportedAppOs === 'Both';
            const oss: string[] = promptForOs ? ['Windows', 'Linux'] : [version.supportedAppOs];
            for (const os of oss) {
                if (version.appOsToSkip !== os && version.buildMachineOsToSkip !== process.platform) {
                    parallelTests.push({
                        title: `${runtime} - ${os}`,
                        callback: async () => {
                            const testFolderPath: string = getWorkspacePath(testCase.workspaceFolder || version.version);
                            await testCreateWebAppAndDeploy(os, promptForOs, runtime, testFolderPath, version.version);
                        }
                    });
                }
            }
        }
    }

    suiteSetup(function (this: Mocha.Context): void {
        if (!longRunningTestsEnabled) {
            this.skip();
        }

        for (const t of parallelTests) {
            t.task = t.callback();
        }
    });

    for (const t of parallelTests) {
        test(t.title, async () => {
            await nonNullProp(t, 'task');
        });
    }

    async function testCreateWebAppAndDeploy(os: string, promptForOs: boolean, runtime: string, workspacePath: string, expectedVersion: string): Promise<void> {
        const resourceName: string = getRandomHexString();
        const resourceGroupName = getRandomHexString();
        resourceGroupsToDelete.push(resourceGroupName);

        const testInputs: (string | RegExp)[] = [resourceName, '$(plus) Create new resource group', resourceGroupName, runtime];
        if (promptForOs) {
            testInputs.push(os);
        }

        testInputs.push(getRotatingLocation(), '$(plus) Create new App Service plan', getRandomHexString(), getRotatingPricingTier(), '$(plus) Create new Application Insights resource', getRandomHexString());

        await runWithTestActionContext('CreateWebAppAdvanced', async context => {
            await context.ui.runWithInputs(testInputs, async () => {
                await createWebAppAdvanced(context);
            });
        });
        const createdApp: WebSiteManagementModels.Site | undefined = await tryGetWebApp(webSiteClient, resourceGroupName, resourceName);
        assert.ok(createdApp);

        await runWithTestActionContext('Deploy', async context => {
            await context.ui.runWithInputs([workspacePath, resourceName, 'Deploy'], async () => {
                await deploy(context);
            });
        });

        const hostUrl: string | undefined = (<WebAppTreeItem>await ext.tree.findTreeItem(<string>createdApp?.id, await createTestActionContext())).site.defaultHostUrl;
        const client: ServiceClient = await createGenericClient(await createTestActionContext(), undefined);
        const response: HttpOperationResponse = await client.sendRequest({ method: 'GET', url: hostUrl });
        assert.strictEqual(response.bodyAsText, `Version: ${expectedVersion}`);
    }
});

// The workspace folder that vscode is opened against for tests
function getWorkspacePath(testWorkspaceName: string): string {
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
        assert.strictEqual(path.basename(workspacePath), testWorkspaceName, "Opened against an unexpected workspace.");
        return workspacePath;
    }
}

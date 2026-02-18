/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type Site } from '@azure/arm-appservice';
import { tryGetWebApp } from '@microsoft/vscode-azext-azureappservice';
import { createTestActionContext, nonNullProp, runWithTestActionContext } from '@microsoft/vscode-azext-utils';
import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { SiteTreeItem } from '../../src/tree/SiteTreeItem';
import { cpUtils } from '../../src/utils/cpUtils';
import { delay } from '../../src/utils/delay';
import { getRandomHexString } from '../../src/utils/randomUtils';
import { longRunningTestsEnabled, testSubscription, webSiteClient } from '../global.test';
import { getResourceGroupsTestApi } from '../utils/resourceGroupsTestApiAccess';
import { getCachedTestApi } from '../utils/testApiAccess';
import { resourceGroupsToDelete } from './aaa_global.resource.test';
import { getRotatingLocation, getRotatingPricingTier } from './getRotatingValue';

interface ITestCase {
    /**
     * If undefined, use the version as the folder name
     */
    workspaceFolder: string | undefined;
    runtimePrefix: string;
    versions: IVersionInfo[];
    zipFile?: string | undefined;
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

suite('Create Web App and deploy', async function (this: Mocha.Suite): Promise<void> {
    this.timeout(6 * 60 * 1000);
    const testCases: ITestCase[] = [
        {
            runtimePrefix: 'Node',
            workspaceFolder: 'nodejs-docs-hello-world',
            versions: [
                { version: '18', supportedAppOs: 'Both', displayText: '18 LTS' },
                { version: '20', supportedAppOs: 'Both', displayText: '20 LTS' },
                { version: '22', supportedAppOs: 'Both', displayText: '22 LTS' },
            ]
        },
        {
            runtimePrefix: 'Node',
            workspaceFolder: 'testFolder',
            zipFile: 'node-hello-1.zip',
            versions: [
                { version: '22', supportedAppOs: 'Both', displayText: '22 LTS' }
            ]
        },
        {
            runtimePrefix: '.NET',
            workspaceFolder: undefined,
            versions: [
                { version: '10.0', supportedAppOs: 'Both', displayText: '10 (LTS)' },
                { version: '9.0', supportedAppOs: 'Both', displayText: '9 (STS)', buildMachineOsToSkip: 'darwin' }, // Not sure why this fails on mac build machines - worth investigating in the future
                { version: '8.0', supportedAppOs: 'Both', displayText: '8 (LTS)', buildMachineOsToSkip: 'darwin' }
            ]
        },
        {
            runtimePrefix: 'Python',
            workspaceFolder: 'python-docs-hello-world',
            versions: [
                { version: '3.13', supportedAppOs: 'Linux' },
                { version: '3.12', supportedAppOs: 'Linux' },
                { version: '3.11', supportedAppOs: 'Linux' }
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
                            // if the testFolderPath is just testFolder, we need to use the zip file that is in there
                            const testFolderPath: string = getWorkspacePath(testCase.workspaceFolder || version.version);
                            const zipFile: string | undefined = testCase.zipFile;
                            await testCreateWebAppAndDeploy(os, promptForOs, runtime, testFolderPath, version.version, zipFile);
                        }
                    });
                }
            }
        }
    }

    suiteSetup(async function (this: Mocha.Context): Promise<void> {
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

    async function testCreateWebAppAndDeploy(os: string, promptForOs: boolean, runtime: string, workspacePath: string, expectedVersion: string, zipFile?: string): Promise<void> {
        const resourceName: string = getRandomHexString();
        const resourceGroupName = getRandomHexString();
        resourceGroupsToDelete.push(resourceGroupName);

        const testInputs: (string | RegExp)[] = [getRotatingLocation(), 'Secure unique default hostname', '$(plus) Create new resource group', resourceGroupName, resourceName, runtime];
        if (promptForOs) {
            testInputs.push(os);
        }

        testInputs.push('$(plus) Create new App Service plan', getRandomHexString(), getRotatingPricingTier(), '$(plus) Create new Application Insights resource', getRandomHexString());

        const testApi = getCachedTestApi();
        await runWithTestActionContext('CreateWebAppAdvanced', async context => {
            await context.ui.runWithInputs(testInputs, async () => {
                await testApi.commands.createWebAppAdvanced(context, testSubscription);
            });
        });
        await delay(10 * 1000); // give some time for the web app to be fully provisioned before we try to deploy
        const createdApp: Site | undefined = await tryGetWebApp(webSiteClient, resourceGroupName, resourceName);
        assert.ok(createdApp);
        const createdAppId: string = nonNullProp(createdApp, 'id');
        const rgTestApi = await getResourceGroupsTestApi();
        const context = await createTestActionContext();
        const siteTreeItem: SiteTreeItem = (<SiteTreeItem>await rgTestApi.compatibility.getAppResourceTree().findTreeItem(createdAppId, context));

        await runWithTestActionContext('Deploy', async context => {
            const inputs = [workspacePath];
            if (zipFile) {
                inputs.shift(); // remove workspacePath since we will be passing the zip file directly to the deploy command
            }

            await context.ui.runWithInputs(inputs, async () => {
                await testApi.commands.deploy(context, siteTreeItem, zipFile ? vscode.Uri.file(path.join(workspacePath, zipFile)) : undefined);
            });

        });

        await siteTreeItem.initSite(context);
        const hostUrl = siteTreeItem.site.defaultHostName;

        // Use curl for a simple end-to-end verification that the deployed site is serving expected content.
        // Note: defaultHostName is typically a hostname (no protocol), so we normalize to an https URL.
        const url: string = /^https?:\/\//i.test(hostUrl) ? hostUrl : `https://${hostUrl}`;

        // Retry up to 10 times over ~5 minutes to allow the app time to finish building/starting.
        // Linux apps can take 2-5 minutes for remote builds (e.g. Oryx for Python).
        const maxAttempts = 5;
        const delayMs = 15_000; // 30 seconds between attempts
        let lastError: unknown;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const body: string = await cpUtils.executeCommand(undefined, undefined, 'curl', '--fail', '--silent', '--show-error', '--location', url);
                if (zipFile) {
                    assert.strictEqual(body.trim(), 'Hello Node!');
                    return;

                } else {
                    assert.strictEqual(body.trim(), `Version: ${expectedVersion}`);
                    return; // success
                }
            } catch (error) {
                lastError = error;
                if (attempt < maxAttempts) {
                    await delay(delayMs);
                }
            }
        }
        throw lastError;
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

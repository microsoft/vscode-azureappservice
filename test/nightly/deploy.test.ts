/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type Site } from '@azure/arm-appservice';
import { type ServiceClient } from '@azure/core-client';
import { createPipelineRequest } from '@azure/core-rest-pipeline';
import { tryGetWebApp } from '@microsoft/vscode-azext-azureappservice';
import { type AzExtPipelineResponse } from '@microsoft/vscode-azext-azureutils';
import { createTestActionContext, runWithTestActionContext } from '@microsoft/vscode-azext-dev';
import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { createGenericClient, createWebAppAdvanced, deploy, ext, getRandomHexString, nonNullProp, type SiteTreeItem } from '../../extension.bundle';
import { longRunningTestsEnabled } from '../global.test';
import { getRotatingPricingTier } from './getRotatingValue';
import { azcodeResourcePrefix, resourceGroupsToDelete, webSiteClient } from './global.nightly.test';

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

suite.only('Create Web App and deploy', function (this: Mocha.Suite): void {
    this.timeout(6 * 60 * 1000);
    const testCases: ITestCase[] = [
        {
            runtimePrefix: 'Node',
            workspaceFolder: 'nodejs-docs-hello-world',
            versions: [
                { version: '16', supportedAppOs: 'Both', displayText: '16 LTS' },
                // { version: '18', supportedAppOs: 'Both', displayText: '18 LTS' },
                // { version: '20', supportedAppOs: 'Both', displayText: '20 LTS' }
            ]
        },
        // {
        //     runtimePrefix: 'Node',
        //     workspaceFolder: 'node-zip',
        //     zipFile: 'node-hello-1.zip',
        //     versions: [
        //         { version: '20', supportedAppOs: 'Both', displayText: '20 LTS' }
        //     ]
        // },
        // {
        //     runtimePrefix: '.NET',
        //     workspaceFolder: 'dotnet-hello-world',
        //     versions: [
        //         { version: '6', supportedAppOs: 'Both', displayText: '6 (LTS)' },
        //         // { version: '7', supportedAppOs: 'Both', displayText: '7 (STS)', /** buildMachineOsToSkip: 'darwin' */ }, // Not sure why this fails on mac build machines - worth investigating in the future
        //         // { version: '8', supportedAppOs: 'Both', displayText: '8 (LTS)', /** buildMachineOsToSkip: 'darwin' */ }
        //     ]
        // },
        // {
        //     runtimePrefix: 'Python',
        //     workspaceFolder: 'python-docs-hello-world',
        //     versions: [
        //         { version: '3.8', supportedAppOs: 'Linux' },
        //         { version: '3.9', supportedAppOs: 'Linux' },
        //         { version: '3.10', supportedAppOs: 'Linux' },
        //         { version: '3.11', supportedAppOs: 'Linux' },
        //         { version: '3.12', supportedAppOs: 'Linux' }
        //     ]
        // }
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

    async function testCreateWebAppAndDeploy(os: string, promptForOs: boolean, runtime: string, workspacePath: string, expectedVersion: string, zipFile?: string): Promise<void> {
        const resourceName: string = getRandomHexString();
        const resourceGroupName: string = azcodeResourcePrefix + getRandomHexString(6);
        resourceGroupsToDelete.add(resourceGroupName);

        const testInputs: (string | RegExp)[] = [resourceName, '$(plus) Create new resource group', resourceGroupName, runtime];
        if (promptForOs) {
            testInputs.push(os);
        }
        testInputs.push('East US', '$(plus) Create new App Service plan', getRandomHexString(), getRotatingPricingTier(), 'Enabled', '$(plus) Create new Application Insights resource', getRandomHexString());

        await runWithTestActionContext('CreateWebAppAdvanced', async context => {
            await context.ui.runWithInputs(testInputs, async () => {
                try {
                    await createWebAppAdvanced(context);
                } catch (e) {
                    console.error(e);
                }
            });
        });

        const createdApp: Site | undefined = await tryGetWebApp(webSiteClient, resourceGroupName, resourceName);
        assert.ok(createdApp);

        await runWithTestActionContext('Deploy', async context => {
            await context.ui.runWithInputs([workspacePath, resourceName, 'Deploy'], async () => {
                if (zipFile) {
                    await vscode.commands.executeCommand('appService.Deploy', vscode.Uri.file(path.join(workspacePath, zipFile)), undefined, true /*isNewApp*/);
                } else {
                    await deploy(context);
                }
            });
        });

        const hostUrl: string | undefined = (<SiteTreeItem>await ext.rgApi.tree.findTreeItem(<string>createdApp?.id, await createTestActionContext())).site.defaultHostUrl;
        const client: ServiceClient = await createGenericClient(await createTestActionContext(), undefined);
        const response: AzExtPipelineResponse = await client.sendRequest(createPipelineRequest({ method: 'GET', url: hostUrl }));
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

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerAppServiceExtensionVariables } from '@microsoft/vscode-azext-azureappservice';
import { registerAzureUtilsExtensionVariables, SubscriptionTreeItemBase } from '@microsoft/vscode-azext-azureutils';
import { callWithTelemetryAndErrorHandling, createApiProvider, createAzExtOutputChannel, createExperimentationService, registerErrorHandler, registerReportIssueCommand, registerUIExtensionVariables, type apiUtils, type AzureExtensionApi, type IActionContext } from '@microsoft/vscode-azext-utils';
import { AzExtResourceType } from '@microsoft/vscode-azureresources-api';
import * as vscode from 'vscode';
import { AppServiceFileSystem } from './AppServiceFileSystem';
import { revealTreeItem } from './commands/api/revealTreeItem';
import { addAppSetting } from './commands/appSettings/addAppSetting';
import { deleteAppSetting } from './commands/appSettings/deleteAppSettings';
import { createWebApp, createWebAppAdvanced } from './commands/createWebApp/createWebApp';
import { deleteWebApp } from './commands/deleteWebApp';
import { deploy } from './commands/deploy/deploy';
import { editScmType } from './commands/deployments/editScmType';
import { registerCommands } from './commands/registerCommands';
import { ext } from './extensionVariables';
import type { TestApi } from './testApi';
import { getResourceGroupsApi } from './utils/getExtensionApi';
import { WebAppResolver } from './WebAppResolver';

export async function activateInternal(
    context: vscode.ExtensionContext,
    perfStats: {
        loadStartTime: number, loadEndTime: number
    },
    ignoreBundle?: boolean
): Promise<apiUtils.AzureExtensionApiProvider> {
    ext.context = context;
    ext.ignoreBundle = ignoreBundle;

    ext.outputChannel = createAzExtOutputChannel("Azure App Service", ext.prefix);
    context.subscriptions.push(ext.outputChannel);

    registerUIExtensionVariables(ext);
    registerAzureUtilsExtensionVariables(ext);
    registerAppServiceExtensionVariables(ext);

    await callWithTelemetryAndErrorHandling('appService.activate', async (activateContext: IActionContext) => {
        activateContext.telemetry.properties.isActivationEvent = 'true';
        activateContext.telemetry.measurements.mainFileLoad = (perfStats.loadEndTime - perfStats.loadStartTime) / 1000;
        activateContext.errorHandling.rethrow = true;

        registerCommands();

        // Suppress "Report an Issue" button for all errors in favor of the command
        registerErrorHandler(c => c.errorHandling.suppressReportIssue = true);
        registerReportIssueCommand('appService.ReportIssue');

        ext.experimentationService = await createExperimentationService(context);

        ext.rgApi = await getResourceGroupsApi();

        ext.rgApi.registerApplicationResourceResolver(AzExtResourceType.AppServices, new WebAppResolver());

        ext.fileSystem = new AppServiceFileSystem(ext.rgApi.tree);
        context.subscriptions.push(vscode.workspace.registerFileSystemProvider(AppServiceFileSystem.scheme, ext.fileSystem));
    }
    );
    const apis: (AzureExtensionApi | TestApi)[] = [
        <AzureExtensionApi>{
            deploy,
            revealTreeItem,
            apiVersion: '1.0.0',
            extensionVariables: ext
        }
    ];

    // Add test API when running tests
    // This allows tests to access and override internal extension state without changing the public API.
    if (process.env.VSCODE_RUNNING_TESTS) {
        apis.push(<TestApi>{
            apiVersion: '99.0.0',
            extensionVariables: {
                getOutputChannel: () => ext.outputChannel,
                getContext: () => ext.context,
                getRgApi: () => ext.rgApi,
                getIgnoreBundle: () => ext.ignoreBundle
            },
            testing: {
                setOverrideRgApi: (api) => {
                    // Intentionally allow clearing in tests
                    ext.rgApi = api as unknown as typeof ext.rgApi;
                },
                setIgnoreBundle: (ignoreBundle) => {
                    ext.ignoreBundle = ignoreBundle;
                }
            },
            commands: {
                createWebApp,
                createWebAppAdvanced,
                editScmType,
                addAppSetting,
                deleteAppSetting,
                deleteWebApp,
                deploy: async (context: IActionContext, zipFilePath?: vscode.Uri, testSubscription?: SubscriptionTreeItemBase) => {
                    await deploy(context, zipFilePath, undefined, true, testSubscription);
                    return;
                }
            }
        });
    }

    return createApiProvider(apis);

}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivateInternal(): void {
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerAppServiceExtensionVariables } from '@microsoft/vscode-azext-azureappservice';
import { callWithTelemetryAndErrorHandling, createApiProvider, createAzExtOutputChannel, createExperimentationService, registerErrorHandler, registerReportIssueCommand, type apiUtils, type AzureExtensionApi, type IActionContext } from '@microsoft/vscode-azext-utils';
import { AzExtResourceType } from '@microsoft/vscode-azureresources-api';
import * as vscode from 'vscode';
import { AppServiceFileSystem } from './AppServiceFileSystem';
import { revealTreeItem } from './commands/api/revealTreeItem';
import { registerCommands } from './commands/registerCommands';
import { ext, registerExtensionVariables, type IAppServiceExtensionVariables } from './extensionVariables';
import { getResourceGroupsApi } from './utils/getExtensionApi';
import { WebAppResolver } from './WebAppResolver';

export async function activateInternal(
    context: vscode.ExtensionContext,
    perfStats: {
        loadStartTime: number, loadEndTime: number
    },
    ignoreBundle?: boolean
): Promise<apiUtils.AzureExtensionApiProvider> {
    // Create and register extension variables
    const outputChannel = createAzExtOutputChannel("Azure App Service", 'appService');
    context.subscriptions.push(outputChannel);

    const extVars: IAppServiceExtensionVariables = {
        context,
        outputChannel,
        prefix: 'appService',
        ignoreBundle,
    } as IAppServiceExtensionVariables;

    registerExtensionVariables(extVars);
    registerAppServiceExtensionVariables(ext);

    await callWithTelemetryAndErrorHandling('appService.activate', async (activateContext: IActionContext) => {
        activateContext.telemetry.properties.isActivationEvent = 'true';
        activateContext.telemetry.measurements.mainFileLoad = (perfStats.loadEndTime - perfStats.loadStartTime) / 1000;

        registerCommands();

        // Suppress "Report an Issue" button for all errors in favor of the command
        registerErrorHandler(c => c.errorHandling.suppressReportIssue = true);
        registerReportIssueCommand('appService.ReportIssue');

        ext.experimentationService = await createExperimentationService(context);
        ext.rgApi = await getResourceGroupsApi();
        ext.rgApi.registerApplicationResourceResolver(AzExtResourceType.AppServices, new WebAppResolver());

        ext.fileSystem = new AppServiceFileSystem(ext.rgApi.tree);
        context.subscriptions.push(vscode.workspace.registerFileSystemProvider(AppServiceFileSystem.scheme, ext.fileSystem));
    });

    return createApiProvider([<AzureExtensionApi>{
        revealTreeItem,
        apiVersion: '1.0.0'
    }]);
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivateInternal(): void {
}

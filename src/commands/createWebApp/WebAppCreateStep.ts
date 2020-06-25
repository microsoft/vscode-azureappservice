/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient, WebSiteManagementModels } from 'azure-arm-website';
import { Progress } from 'vscode';
import { AppKind, IAppServiceWizardContext, WebsiteOS } from 'vscode-azureappservice';
import { AzureWizardExecuteStep, createAzureClient } from 'vscode-azureextensionui';
import { ext } from '../../extensionVariables';
import { localize } from '../../localize';
import { nonNullProp } from '../../utils/nonNull';

export class WebAppCreateStep extends AzureWizardExecuteStep<IAppServiceWizardContext> {
    public priority: number = 140;

    public async execute(context: IAppServiceWizardContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        context.telemetry.properties.newSiteOS = context.newSiteOS;
        context.telemetry.properties.newSiteRuntime = context.newSiteRuntime;
        context.telemetry.properties.planSkuTier = context.plan && context.plan.sku && context.plan.sku.tier;

        const message: string = localize('creatingNewApp', 'Creating new web app "{0}"...', context.newSiteName);
        ext.outputChannel.appendLog(message);
        progress.report({ message });

        const siteName: string = nonNullProp(context, 'newSiteName');
        const rgName: string = nonNullProp(nonNullProp(context, 'resourceGroup'), 'name');
        const locationName: string = nonNullProp(nonNullProp(context, 'location'), 'name');

        const newSiteConfig: WebSiteManagementModels.SiteConfig = {};
        if (context.newSiteKind === AppKind.app) {
            newSiteConfig.linuxFxVersion = context.newSiteRuntime;
        }
        newSiteConfig.appSettings = await this.getAppSettings(context);

        const client: WebSiteManagementClient = createAzureClient(context, WebSiteManagementClient);
        context.site = await client.webApps.createOrUpdate(rgName, siteName, {
            name: context.newSiteName,
            kind: context.newSiteKind,
            location: locationName,
            serverFarmId: context.plan && context.plan.id,
            clientAffinityEnabled: true,
            siteConfig: newSiteConfig,
            reserved: context.newSiteOS === WebsiteOS.linux  // The secret property - must be set to true to make it a Linux plan. Confirmed by the team who owns this API.
        });
    }

    public shouldExecute(context: IAppServiceWizardContext): boolean {
        return !context.site;
    }

    private async getAppSettings(context: IAppServiceWizardContext): Promise<WebSiteManagementModels.NameValuePair[]> {
        const appSettings: WebSiteManagementModels.NameValuePair[] = [];
        const disabled: string = 'disabled';

        if (context.appInsightsComponent) {
            appSettings.push({
                name: 'APPINSIGHTS_INSTRUMENTATIONKEY',
                value: context.appInsightsComponent.instrumentationKey
            });

            // all these settings are set on the portal if AI is enabled for Windows apps
            if (context.newSiteOS === WebsiteOS.windows) {
                appSettings.push(
                    {
                        name: 'APPINSIGHTS_PROFILERFEATURE_VERSION',
                        value: disabled
                    },
                    {
                        name: 'APPINSIGHTS_SNAPSHOTFEATURE_VERSION',
                        value: disabled
                    },
                    {
                        name: 'ApplicationInsightsAgent_EXTENSION_VERSION',
                        value: '~2'
                    },
                    {
                        name: 'DiagnosticServices_EXTENSION_VERSION',
                        value: disabled
                    },
                    {
                        name: 'InstrumentationEngine_EXTENSION_VERSION',
                        value: disabled
                    },
                    {
                        name: 'SnapshotDebugger_EXTENSION_VERSION',
                        value: disabled
                    },
                    {
                        name: 'XDT_MicrosoftApplicationInsights_BaseExtensions',
                        value: disabled
                    },
                    {
                        name: 'XDT_MicrosoftApplicationInsights_Mode',
                        value: 'default'
                    });
            } else {
                appSettings.push({
                    name: 'APPLICATIONINSIGHTSAGENT_EXTENSION_ENABLED',
                    value: 'true'
                });
            }
        }

        return appSettings;
    }
}

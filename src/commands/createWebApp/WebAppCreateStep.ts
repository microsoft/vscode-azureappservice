/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type NameValuePair, type Site, type SiteConfig, type WebSiteManagementClient } from '@azure/arm-appservice';
import { WebsiteOS, type CustomLocation } from '@microsoft/vscode-azext-azureappservice';
import { LocationListStep } from '@microsoft/vscode-azext-azureutils';
import { AzureWizardExecuteStep } from '@microsoft/vscode-azext-utils';
import { type AppResource } from '@microsoft/vscode-azext-utils/hostapi';
import { type Progress } from 'vscode';
import * as constants from '../../constants';
import { ext } from '../../extensionVariables';
import { localize } from '../../localize';
import { createWebSiteClient } from '../../utils/azureClients';
import { nonNullProp } from '../../utils/nonNull';
import { type FullJavaStack, type FullWebAppStack, type IWebAppWizardContext } from './IWebAppWizardContext';
import { getJavaLinuxRuntime } from './stacks/getJavaLinuxRuntime';
import { type WebAppStackValue, type WindowsJavaContainerSettings } from './stacks/models/WebAppStackModel';

export class WebAppCreateStep extends AzureWizardExecuteStep<IWebAppWizardContext> {
    public priority: number = 140;

    public async execute(context: IWebAppWizardContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        context.telemetry.properties.newSiteOS = context.newSiteOS;
        context.telemetry.properties.newSiteStack = context.newSiteStack?.stack.value;
        context.telemetry.properties.newSiteMajorVersion = context.newSiteStack?.majorVersion.value;
        context.telemetry.properties.newSiteMinorVersion = context.newSiteStack?.minorVersion.value;
        if (context.newSiteJavaStack) {
            context.telemetry.properties.newSiteJavaStack = context.newSiteJavaStack.stack.value;
            context.telemetry.properties.newSiteJavaMajorVersion = context.newSiteJavaStack.majorVersion.value;
            context.telemetry.properties.newSiteJavaMinorVersion = context.newSiteJavaStack.minorVersion.value;
        }
        context.telemetry.properties.planSkuTier = context.plan && context.plan.sku && context.plan.sku.tier;

        const message: string = localize('creatingNewApp', 'Creating new web app "{0}"...', context.newSiteName);
        ext.outputChannel.appendLog(message);
        progress.report({ message });

        const siteName: string = nonNullProp(context, 'newSiteName');
        const rgName: string = nonNullProp(nonNullProp(context, 'resourceGroup'), 'name');

        const client: WebSiteManagementClient = await createWebSiteClient(context);
        context.site = (await client.webApps.beginCreateOrUpdateAndWait(rgName, siteName, await this.getNewSite(context)));
        context.activityResult = context.site as AppResource;
    }

    public shouldExecute(context: IWebAppWizardContext): boolean {
        return !context.site;
    }

    private async getNewSite(context: IWebAppWizardContext): Promise<Site> {
        const location = await LocationListStep.getLocation(context, constants.webProvider);
        const newSiteConfig: SiteConfig = this.getSiteConfig(context);

        const site: Site = {
            name: context.newSiteName,
            kind: this.getKind(context),
            location: nonNullProp(location, 'name'),
            serverFarmId: context.plan && context.plan.id,
            clientAffinityEnabled: true,
            siteConfig: newSiteConfig,
            reserved: context.newSiteOS === WebsiteOS.linux  // The secret property - must be set to true to make it a Linux plan. Confirmed by the team who owns this API.
        };

        if (context.customLocation) {
            this.addCustomLocationProperties(site, context.customLocation);
        }

        return site;
    }

    private getKind(context: IWebAppWizardContext): string {
        let kind: string = context.newSiteKind;
        if (context.newSiteOS === 'linux') {
            kind += ',linux';
        }
        if (context.customLocation) {
            kind += ',kubernetes';
        }
        return kind;
    }

    private addCustomLocationProperties(site: Site, customLocation: CustomLocation): void {
        site.extendedLocation = { name: customLocation.id, type: 'customLocation' };
    }

    private getSiteConfig(context: IWebAppWizardContext): SiteConfig {
        const newSiteConfig: SiteConfig = {};

        newSiteConfig.appSettings = this.getAppSettings(context);

        const stack: FullWebAppStack = nonNullProp(context, 'newSiteStack');
        if (context.newSiteOS === WebsiteOS.linux) {
            newSiteConfig.linuxFxVersion = stack.stack.value === 'java' ?
                getJavaLinuxRuntime(stack.majorVersion.value, nonNullProp(context, 'newSiteJavaStack').minorVersion) :
                nonNullProp(stack.minorVersion.stackSettings, 'linuxRuntimeSettings').runtimeVersion;
        } else {
            const runtimeVersion: string = nonNullProp(stack.minorVersion.stackSettings, 'windowsRuntimeSettings').runtimeVersion;
            switch (stack.stack.value) {
                case 'dotnet':
                    if (!/core/i.test(stack.minorVersion.displayText)) { // Filter out .NET _Core_ stacks because this is a .NET _Framework_ property
                        newSiteConfig.netFrameworkVersion = runtimeVersion;
                    }
                    break;
                case 'php':
                    newSiteConfig.phpVersion = runtimeVersion;
                    break;
                case 'node':
                    newSiteConfig.nodeVersion = runtimeVersion;
                    newSiteConfig.appSettings.push({
                        name: 'WEBSITE_NODE_DEFAULT_VERSION',
                        value: runtimeVersion
                    });
                    break;
                case 'java':
                    newSiteConfig.javaVersion = runtimeVersion;
                    const javaStack: FullJavaStack = nonNullProp(context, 'newSiteJavaStack');
                    const windowsStackSettings: WindowsJavaContainerSettings = nonNullProp(javaStack.minorVersion.stackSettings, 'windowsContainerSettings');
                    newSiteConfig.javaContainer = windowsStackSettings.javaContainer;
                    newSiteConfig.javaContainerVersion = windowsStackSettings.javaContainerVersion;
                    break;
                case 'python':
                    newSiteConfig.pythonVersion = runtimeVersion;
                    break;
                default:
            }
        }
        return newSiteConfig;
    }

    private getAppSettings(context: IWebAppWizardContext): NameValuePair[] {
        const appSettings: NameValuePair[] = [];
        const disabled: string = 'disabled';
        const trueString: string = 'true';

        const runtime: WebAppStackValue = nonNullProp(context, 'newSiteStack').stack.value;
        if (context.newSiteOS === WebsiteOS.linux && (runtime === 'node' || runtime === 'python')) {
            appSettings.push({
                name: 'SCM_DO_BUILD_DURING_DEPLOYMENT',
                value: trueString
            });
        }
        if (context.appInsightsComponent) {
            appSettings.push({
                name: 'APPLICATIONINSIGHTS_CONNECTION_STRING',
                value: context.appInsightsComponent.connectionString
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
                    value: trueString
                });
            }
        }

        return appSettings;
    }
}

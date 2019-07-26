/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { Location } from "azure-arm-resource/lib/subscription/models";
import WebSiteManagementClient from "azure-arm-website";
import { AppServicePlan } from "azure-arm-website/lib/models";
import { ConfigurationTarget, MessageItem, workspace, WorkspaceConfiguration } from "vscode";
import { IAppServiceWizardContext, SiteNameStep, WebsiteOS } from "vscode-azureappservice";
import { createAzureClient, DialogResponses } from "vscode-azureextensionui";
import { extensionPrefix } from "../../constants";
import { ext } from "../../extensionVariables";
import { nonNullProp } from "../../utils/nonNull";
import { createWebAppAdvanced } from "./createWebApp";
import { resetAppWizardContextDefaults } from "./setAppWizardContextDefault";

const maxNumberOfSites: number = 3;

export async function setDefaultRgAndPlanName(wizardContext: IAppServiceWizardContext, siteNameStep: SiteNameStep): Promise<void> {
    // this should always be set when in the basic creation scenario
    const location: Location = nonNullProp(wizardContext, 'location');
    const defaultName: string = `appsvc_${wizardContext.newSiteOS}_${location.name}`;

    const asp: AppServicePlan | null = await getAppServicePlan(wizardContext, defaultName, defaultName);
    if (asp && checkPlanForPerformanceDrop(asp)) {
        // Subscriptions can only have 1 free tier Linux plan so show a warning if there are too many apps on the plan
        if (wizardContext.newSiteOS === WebsiteOS.linux) {
            await promptPerformanceWarning(wizardContext, asp);
            wizardContext.newResourceGroupName = defaultName;
            wizardContext.newPlanName = defaultName;
        } else {
            // Subscriptions can have 10 free tier Windows plans so just create a new one with a suffixed name
            // If there are 10 plans, it'll throw an error that directs them to advanced create

            const client: WebSiteManagementClient = createAzureClient(wizardContext, WebSiteManagementClient);
            const allAppServicePlans: AppServicePlan[] = await client.appServicePlans.list();
            const defaultPlans: AppServicePlan[] = allAppServicePlans.filter(plan => { return plan.name && plan.name.includes(defaultName); });

            // when using appServicePlans.list, the numOfSites are all set to 0 so individually get each plan and look for one with less than 3 sites
            for (const plan of defaultPlans) {
                if (plan.name) {
                    const fullPlanData: AppServicePlan | null = await getAppServicePlan(wizardContext, plan.name, plan.name);
                    if (fullPlanData && !checkPlanForPerformanceDrop(fullPlanData)) {
                        wizardContext.newResourceGroupName = plan.name;
                        wizardContext.newPlanName = plan.name;
                        break;
                    }
                }
            }

            // otherwise create a new rg and asp
            wizardContext.newResourceGroupName = wizardContext.newResourceGroupName || await siteNameStep.getRelatedName(wizardContext, defaultName);
            wizardContext.newPlanName = wizardContext.newResourceGroupName;
        }
    } else {
        wizardContext.newResourceGroupName = defaultName;
        wizardContext.newPlanName = defaultName;
    }
}

export async function getAppServicePlan(wizardContext: IAppServiceWizardContext, rgName: string, newPlanName: string): Promise<AppServicePlan | null> {
    const client: WebSiteManagementClient = createAzureClient(wizardContext, WebSiteManagementClient);
    return await client.appServicePlans.get(rgName, newPlanName);
}

function checkPlanForPerformanceDrop(asp: AppServicePlan): boolean {
    // for free and basic plans, there is a perf drop after 3 active apps are running
    if (asp.numberOfSites !== undefined && asp.numberOfSites >= maxNumberOfSites) {
        // tslint:disable-next-line: strict-boolean-expressions
        const tier: string | undefined = asp.sku && asp.sku.tier;
        if (tier && /^(basic|free)$/i.test(tier)) {
            return true;
        }
    }

    return false;
}

async function promptPerformanceWarning(context: IAppServiceWizardContext, asp: AppServicePlan): Promise<void> {
    context.telemetry.properties.performanceWarning = 'true';
    const workspaceConfig: WorkspaceConfiguration = workspace.getConfiguration(extensionPrefix);
    const showPlanPerformanceWarningSetting: string = 'showPlanPerformanceWarning';
    const showPerfWarning: boolean | undefined = workspaceConfig.get(showPlanPerformanceWarningSetting);

    if (showPerfWarning) {
        context.telemetry.properties.turnOffPerfWarning = 'false';
        context.telemetry.properties.cancelStep = 'showPerfWarning';

        const numberOfSites: number = nonNullProp(asp, 'numberOfSites');
        const createAnyway: MessageItem = { title: 'Create anyway' };
        const inputs: MessageItem[] = [createAnyway, DialogResponses.dontWarnAgain, DialogResponses.cancel];
        const input: MessageItem = await ext.ui.showWarningMessage(`The selected plan currently has ${numberOfSites} apps. Deploying more than ${maxNumberOfSites} apps may degrade the performance on the apps in the plan.  Use "Create Web App... (Advanced)" to change the default resource names.`, { modal: true }, ...inputs);

        if (input === DialogResponses.dontWarnAgain) {
            context.telemetry.properties.turnOffPerfWarning = 'true';
            workspaceConfig.update(showPlanPerformanceWarningSetting, false, ConfigurationTarget.Global);
        }

        context.telemetry.properties.cancelStep = '';
    }
}

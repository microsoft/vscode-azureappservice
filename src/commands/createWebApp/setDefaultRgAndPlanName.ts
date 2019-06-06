/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { Location } from "azure-arm-resource/lib/subscription/models";
import WebSiteManagementClient from "azure-arm-website";
import { AppServicePlan } from "azure-arm-website/lib/models";
import { ConfigurationTarget, MessageItem, workspace, WorkspaceConfiguration } from "vscode";
import { IAppServiceWizardContext, SiteNameStep, WebsiteOS } from "vscode-azureappservice";
import { createAzureClient, DialogResponses, IActionContext, UserCancelledError } from "vscode-azureextensionui";
import { AppServiceDialogResponses, extensionPrefix } from "../../constants";
import { ext } from "../../extensionVariables";
import { nonNullProp } from "../../utils/nonNull";

const maxNumberOfSites: number = 3;

export async function setDefaultRgAndPlanName(wizardContext: IAppServiceWizardContext, siteNameStep: SiteNameStep): Promise<void> {
    // this should always be set when in the basic creation scenario
    const location: Location = nonNullProp(wizardContext, 'location');
    wizardContext.newResourceGroupName = `appsvc_${wizardContext.newSiteOS}_${location.name}`;
    wizardContext.newPlanName = wizardContext.newResourceGroupName;

    const asp: AppServicePlan | null = await getAppServicePlan(wizardContext, wizardContext.newResourceGroupName, wizardContext.newPlanName);
    if (asp) {
        if (checkPlanForPerformanceDrop(asp)) {
            // Subscriptions can only have 1 free tier Linux plan so show a warning if there are too many apps on the plan
            if (wizardContext.newSiteOS === WebsiteOS.linux) {
                await promptPerformanceWarning(wizardContext, asp);
            } else {
                // Subscriptions can have 10 free tier Windows plans so just create a new one with a suffixed name
                // If there are 10 plans, it'll throw an error that directs them to advancedCreation
                wizardContext.newResourceGroupName = await siteNameStep.getRelatedName(wizardContext, wizardContext.newPlanName);
                wizardContext.newPlanName = wizardContext.newResourceGroupName;
            }
        }
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

async function promptPerformanceWarning(context: IActionContext, asp: AppServicePlan): Promise<void> {
    context.telemetry.properties.performanceWarning = 'true';
    const workspaceConfig: WorkspaceConfiguration = workspace.getConfiguration(extensionPrefix);
    const showPlanPerformanceWarningSetting: string = 'showPlanPerformanceWarning';
    const showPerfWarning: boolean | undefined = workspaceConfig.get(showPlanPerformanceWarningSetting);

    if (showPerfWarning) {
        context.telemetry.properties.turnOffPerfWarning = 'false';
        context.telemetry.properties.cancelStep = 'showPerfWarning';

        const numberOfSites: number = nonNullProp(asp, 'numberOfSites');
        const createAnyway: MessageItem = { title: 'Create anyway' };
        const inputs: MessageItem[] = [createAnyway, AppServiceDialogResponses.turnOnAdvancedCreation, DialogResponses.dontWarnAgain];
        const input: MessageItem = await ext.ui.showWarningMessage(`The selected plan currently has ${numberOfSites} apps. Deploying more than ${maxNumberOfSites} apps may degrade the performance on the apps in the plan.`, { modal: true }, ...inputs);

        if (input === AppServiceDialogResponses.turnOnAdvancedCreation) {
            await workspaceConfig.update('advancedCreation', true, ConfigurationTarget.Global);
            context.telemetry.properties.cancelStep = AppServiceDialogResponses.turnOnAdvancedCreation.title;
            throw new UserCancelledError();
        } else if (input === DialogResponses.dontWarnAgain) {
            context.telemetry.properties.turnOffPerfWarning = 'true';
            workspaceConfig.update(showPlanPerformanceWarningSetting, false);
        }
        context.telemetry.properties.cancelStep = '';
    }
}

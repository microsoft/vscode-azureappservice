/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient, WebSiteManagementModels } from '@azure/arm-appservice';
import { SubscriptionModels } from '@azure/arm-subscriptions';
import { MessageItem } from "vscode";
import { SiteNameStep, tryGetAppServicePlan, WebsiteOS } from "vscode-azureappservice";
import { DialogResponses, IActionContext, LocationListStep } from "vscode-azureextensionui";
import { localize } from "../../localize";
import { createWebSiteClient } from "../../utils/azureClients";
import { getResourceGroupFromId } from '../../utils/azureUtils';
import { nonNullProp } from "../../utils/nonNull";
import { getWorkspaceSetting, updateGlobalSetting } from "../../vsCodeConfig/settings";
import { IWebAppWizardContext } from './IWebAppWizardContext';
import { AzConfig, AzConfigProperty, readAzConfig } from "./readAzConfig";

const maxNumberOfSites: number = 3;

export async function setPostPromptDefaults(wizardContext: IWebAppWizardContext, siteNameStep: SiteNameStep): Promise<void> {
    // Reading az config should always happen after prompting because it can cause a few seconds delay
    const config: AzConfig = await readAzConfig(wizardContext, AzConfigProperty.group, AzConfigProperty.location);

    // location should always be set when in the basic creation scenario
    const defaultLocation: SubscriptionModels.Location = nonNullProp(wizardContext, 'location');
    await LocationListStep.setLocation(wizardContext, config.location || nonNullProp(defaultLocation, 'name'));
    const location: SubscriptionModels.Location = nonNullProp(wizardContext, 'location');

    const defaultName: string = `appsvc_${wizardContext.newSiteOS}_${location.name}`;
    const defaultGroupName: string = config.group || defaultName;
    const defaultPlanName: string = defaultName;

    const client: WebSiteManagementClient = await createWebSiteClient(wizardContext);
    const asp: WebSiteManagementModels.AppServicePlan | undefined = await tryGetAppServicePlan(client, defaultGroupName, defaultPlanName);
    if (asp && checkPlanForPerformanceDrop(asp)) {
        // Subscriptions can only have 1 free tier Linux plan so show a warning if there are too many apps on the plan
        if (wizardContext.newSiteOS === WebsiteOS.linux) {
            await promptPerformanceWarning(wizardContext, asp);
            wizardContext.newResourceGroupName = defaultGroupName;
            wizardContext.newPlanName = defaultPlanName;
        } else {
            // Subscriptions can have 10 free tier Windows plans so just create a new one with a suffixed name
            // If there are 10 plans, it'll throw an error that directs them to advanced create

            const allAppServicePlans: WebSiteManagementModels.AppServicePlan[] = await client.appServicePlans.list();
            const defaultPlans: WebSiteManagementModels.AppServicePlan[] = allAppServicePlans.filter(plan => {
                return plan.name && plan.name.includes(defaultPlanName) && getResourceGroupFromId(nonNullProp(plan, 'id')).includes(defaultGroupName);
            });

            // when using appServicePlans.list, the numOfSites are all set to 0 so individually get each plan and look for one with less than 3 sites
            for (const plan of defaultPlans) {
                if (plan.name) {
                    const groupName: string = getResourceGroupFromId(nonNullProp(plan, 'id'));
                    const fullPlanData: WebSiteManagementModels.AppServicePlan | undefined = await tryGetAppServicePlan(client, groupName, plan.name);
                    if (fullPlanData && !checkPlanForPerformanceDrop(fullPlanData)) {
                        wizardContext.newResourceGroupName = groupName;
                        wizardContext.newPlanName = plan.name;
                        break;
                    }
                }
            }

            // otherwise create a new rg and asp
            wizardContext.newResourceGroupName = wizardContext.newResourceGroupName || await siteNameStep.getRelatedName(wizardContext, defaultGroupName);
            if (!wizardContext.newResourceGroupName) {
                throw new Error(localize('noUniqueNameRg', 'Failed to generate unique name for resources. Use advanced creation to manually enter resource names.'));
            }

            wizardContext.newPlanName = await siteNameStep.getRelatedName(wizardContext, defaultPlanName);
            if (!wizardContext.newPlanName) {
                throw new Error(localize('noUniqnueNameAsp', 'Failed to generate unique name for app service plan. Use advanced creation to manually enter plan names.'));
            }
        }
    } else {
        wizardContext.newResourceGroupName = defaultGroupName;
        wizardContext.newPlanName = defaultPlanName;
    }
}

function checkPlanForPerformanceDrop(asp: WebSiteManagementModels.AppServicePlan): boolean {
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

async function promptPerformanceWarning(context: IActionContext, asp: WebSiteManagementModels.AppServicePlan): Promise<void> {
    context.telemetry.properties.performanceWarning = 'true';
    const showPlanPerformanceWarningSetting: string = 'showPlanPerformanceWarning';
    const showPerfWarning: boolean | undefined = getWorkspaceSetting(showPlanPerformanceWarningSetting);

    if (showPerfWarning) {
        context.telemetry.properties.turnOffPerfWarning = 'false';
        context.telemetry.properties.cancelStep = 'showPerfWarning';

        const numberOfSites: number = nonNullProp(asp, 'numberOfSites');
        const createAnyway: MessageItem = { title: localize('createAnyway,', 'Create anyway') };
        const message: string = localize('tooManyPlansWarning', 'The selected plan currently has {0} apps. Deploying more than {1} apps may degrade the performance on the apps in the plan.  Use "Create Web App... (Advanced)" to change the default resource names.', numberOfSites, maxNumberOfSites);
        const input: MessageItem = await context.ui.showWarningMessage(message, { modal: true }, createAnyway, DialogResponses.dontWarnAgain);

        if (input === DialogResponses.dontWarnAgain) {
            context.telemetry.properties.turnOffPerfWarning = 'true';
            await updateGlobalSetting(showPlanPerformanceWarningSetting, false);
        }

        context.telemetry.properties.cancelStep = '';
    }
}

/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { type Site } from "@azure/arm-appservice";
import { AppInsightsCreateStep, AppInsightsListStep, AppKind, AppServicePlanCreateStep, AppServicePlanListStep, AppServicePlanSkuStep, createWebSiteClient, CustomLocationListStep, LogAnalyticsCreateStep, setLocationsTask, SiteDomainNameLabelScopeStep, SiteNameStep } from "@microsoft/vscode-azext-azureappservice";
import { LocationListStep, parseAzureResourceGroupId, ResourceGroupCreateStep, ResourceGroupListStep, uiUtils, VerifyProvidersStep } from "@microsoft/vscode-azext-azureutils";
import { AzureWizardPromptStep, createSubscriptionContext, nonNullProp, type AzureWizardExecuteStep, type IAzureQuickPickItem, type IWizardOptions } from "@microsoft/vscode-azext-utils";
import { webProvider } from "../../constants";
import { localize } from "../../localize";
import { type IWebAppWizardContext } from "../createWebApp/IWebAppWizardContext";
import { SetPostPromptDefaultsStep } from "../createWebApp/SetPostPromptDefaultsStep";
import { setPrePromptDefaults } from "../createWebApp/setPrePromptDefaults";
import { WebAppStackStep } from "../createWebApp/stacks/WebAppStackStep";
import { WebAppCreateStep } from "../createWebApp/WebAppCreateStep";
import { StartingResourcesLogStep } from "../StartingResourcesLogStep";
import { type IWebAppDeployContext } from "./getOrCreateWebApp";

export class WebAppListStep extends AzureWizardPromptStep<IWebAppDeployContext> {
    public async prompt(context: IWebAppDeployContext): Promise<void> {
        const pick = await context.ui.showQuickPick(this.getPicks(context), { placeHolder: localize('selectWebApp', 'Select a web app') });
        context.site = pick.data;
    }

    public shouldPrompt(context: IWebAppDeployContext): boolean {
        return !context.site;
    }

    private async getPicks(context: IWebAppDeployContext): Promise<IAzureQuickPickItem<Site | undefined>[]> {
        const client = await createWebSiteClient([context, createSubscriptionContext(nonNullProp(context, 'subscription'))]);
        const sites = await uiUtils.listAllIterator(client.webApps.list());
        const qp: IAzureQuickPickItem<Site | undefined>[] = sites
            .filter(s => !s.kind?.includes('functionapp'))
            .map(site => {
                return {
                    label: nonNullProp(site, 'name'),
                    description: parseAzureResourceGroupId(nonNullProp(site, 'id')).resourceGroup,
                    data: site
                };
            });

        qp.unshift({ label: localize('createNewWebApp', '$(plus) Create new web app...'), data: undefined });
        return qp;
    }

    public async getSubWizard(context: IWebAppDeployContext): Promise<IWizardOptions<IWebAppDeployContext> | undefined> {
        if (context.site) {
            return undefined;
        }

        const wizardContext = context as unknown as IWebAppWizardContext;
        wizardContext.newSiteKind = AppKind.app;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (wizardContext as any).resourceGroupDeferLocationStep = true;

        await setPrePromptDefaults(wizardContext);

        const promptSteps: AzureWizardPromptStep<IWebAppWizardContext>[] = [];
        const executeSteps: AzureWizardExecuteStep<IWebAppWizardContext>[] = [];

        // #region SiteNameStep pre-requisites
        LocationListStep.addStep(wizardContext, promptSteps);
        promptSteps.push(new SiteDomainNameLabelScopeStep());
        if (context.advancedCreation) {
            promptSteps.push(new ResourceGroupListStep());
        }
        // #endregion

        const siteStep: SiteNameStep = new SiteNameStep();
        promptSteps.push(siteStep);

        if (context.advancedCreation) {
            promptSteps.push(new WebAppStackStep());
            CustomLocationListStep.addStep(wizardContext, promptSteps);
            promptSteps.push(new AppServicePlanListStep());
            promptSteps.push(new AppInsightsListStep());
        } else {
            promptSteps.push(new WebAppStackStep());
            promptSteps.push(new AppServicePlanSkuStep());
            executeSteps.push(new ResourceGroupCreateStep());
            executeSteps.push(new AppServicePlanCreateStep());
            executeSteps.push(new AppInsightsCreateStep());
            executeSteps.push(new SetPostPromptDefaultsStep(siteStep));
        }

        promptSteps.push(new StartingResourcesLogStep());
        executeSteps.push(new VerifyProvidersStep([webProvider, 'Microsoft.Insights']));
        executeSteps.push(new LogAnalyticsCreateStep());
        executeSteps.push(new WebAppCreateStep());

        if (wizardContext.newSiteOS !== undefined) {
            await setLocationsTask(wizardContext);
        }

        return {
            promptSteps: promptSteps as unknown as AzureWizardPromptStep<IWebAppDeployContext>[],
            executeSteps: executeSteps as unknown as AzureWizardExecuteStep<IWebAppDeployContext>[]
        };
    }
}

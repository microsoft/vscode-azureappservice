/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppInsightsCreateStep, AppInsightsListStep, AppKind, AppServicePlanCreateStep, AppServicePlanListStep, AppServicePlanSkuStep, CustomLocationListStep, LogAnalyticsCreateStep, ParsedSite, setLocationsTask, SiteDomainNameLabelScopeStep, SiteNameStep } from "@microsoft/vscode-azext-azureappservice";
import { LocationListStep, ResourceGroupCreateStep, ResourceGroupListStep, SubscriptionTreeItemBase, VerifyProvidersStep } from "@microsoft/vscode-azext-azureutils";
import { AzureWizard, maskUserInfo, nonNullProp, parseError, type AzExtParentTreeItem, type AzureWizardExecuteStep, type AzureWizardPromptStep, type IActionContext, type ICreateChildImplContext } from "@microsoft/vscode-azext-utils";
import { webProvider } from "../../constants";
import { ext } from "../../extensionVariables";
import { localize } from "../../localize";
import { SiteTreeItem } from "../../tree/SiteTreeItem";
import { createActivityContext } from "../../utils/activityUtils";
import { type IWebAppWizardContext } from "./IWebAppWizardContext";
import { SetPostPromptDefaultsStep } from "./SetPostPromptDefaultsStep";
import { setPrePromptDefaults } from "./setPrePromptDefaults";
import { getCreatedWebAppMessage, showCreatedWebAppMessage } from "./showCreatedWebAppMessage";
import { WebAppStackStep } from "./stacks/WebAppStackStep";
import { WebAppCreateStep } from "./WebAppCreateStep";

function isSubscription(item?: AzExtParentTreeItem): boolean {
    try {
        // Accessing item.subscription throws an error for some workspace items
        // see https://github.com/microsoft/vscode-azurefunctions/issues/3731
        return !!item && !!item.subscription;
    } catch {
        return false;
    }
}

export async function createWebApp(context: IActionContext & Partial<ICreateChildImplContext>, node?: SubscriptionTreeItemBase | undefined, _nodes?: (SubscriptionTreeItemBase | undefined)[], suppressCreatedWebAppMessage: boolean = false): Promise<SiteTreeItem> {
    if (!node || !isSubscription(node)) {
        node = <SubscriptionTreeItemBase>await ext.rgApi.tree.showTreeItemPicker(SubscriptionTreeItemBase.contextValue, context);
    }

    const wizardContext: IWebAppWizardContext = Object.assign(context, node.subscription, {
        newSiteKind: AppKind.app,
        resourceGroupDeferLocationStep: true,
        ...(await createActivityContext({ withChildren: true }))
    });

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

    executeSteps.push(new VerifyProvidersStep([webProvider, 'Microsoft.Insights']));
    executeSteps.push(new LogAnalyticsCreateStep());
    executeSteps.push(new WebAppCreateStep());

    if (wizardContext.newSiteOS !== undefined) {
        await setLocationsTask(wizardContext);
    }

    const title: string = localize('createApp', 'Create new web app');
    const wizard: AzureWizard<IWebAppWizardContext> = new AzureWizard(wizardContext, { promptSteps, executeSteps, title });

    await wizard.prompt();

    const newSiteName = nonNullProp(wizardContext, 'newSiteName');
    wizardContext.activityTitle = localize('createWebApp', 'Create Web App "{0}"', newSiteName);

    await wizard.execute();
    await ext.rgApi.appResourceTree.refresh(context);

    const rawSite = nonNullProp(wizardContext, 'site');
    const site = new ParsedSite(rawSite, wizardContext);
    ext.outputChannel.appendLog(getCreatedWebAppMessage(site));

    const newNode: SiteTreeItem = new SiteTreeItem(node, rawSite);
    try {
        //enable HTTP & Application logs (only for windows) by default
        await newNode.enableLogs(context);
    } catch (error) {
        // optional part of creating web app, so not worth blocking on error
        context.telemetry.properties.fileLoggingError = maskUserInfo(parseError(error).message, []);
    }

    if (!suppressCreatedWebAppMessage) {
        showCreatedWebAppMessage(context, newNode);
    }
    return newNode;
}

export async function createWebAppAdvanced(context: IActionContext, node?: AzExtParentTreeItem | undefined): Promise<SiteTreeItem> {
    return await createWebApp({ ...context, advancedCreation: true }, node);
}

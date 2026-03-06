/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AppInsightsCreateStep, AppInsightsListStep, LogAnalyticsCreateStep, type IAppServiceWizardContext } from "@microsoft/vscode-azext-azureappservice";
import { AzureWizard, type AzureWizardExecuteStep, type AzureWizardPromptStep, type GenericTreeItem, type IActionContext } from "@microsoft/vscode-azext-utils";
import { SiteTreeItem } from "src/tree/SiteTreeItem";
import { webAppFilter } from "../../constants";
import { ext } from "../../extensionVariables";
import { localize } from "../../localize";
import { CodeOptimizationsTreeItem } from "../../tree/CodeOptimizationTreeItem";

/**
 * Attaches an Application Insights resource to a web app that doesn't already have one.
 * Walks the user through an Azure wizard to select or create an App Insights instance,
 * then writes the resulting connection string into the web app's application settings.
 *
 * @param context - The action context for telemetry and user interaction.
 * @param node - The tree item representing the "App Insights not enabled" node.
 *               If not provided, the user will be prompted to pick a qualifying web app.
 */
export async function enableAppInsights(context: IActionContext, node?: GenericTreeItem | undefined): Promise<void> {
    // If invoked without a specific tree node (e.g. from the command palette), prompt the user to pick one
    let siteTreeItem: SiteTreeItem;
    if (!node || !(node.parent instanceof CodeOptimizationsTreeItem)) {
        const noItemFoundErrorMessage: string = localize('noAppInsightsNotEnabled', 'Select a web app to enable Application Insights.');
        siteTreeItem = await ext.rgApi.pickAppResource<SiteTreeItem>({ ...context, noItemFoundErrorMessage }, {
            filter: webAppFilter,
            expectedChildContextValue: new RegExp("applicationInsightsNotEnabled")
        });
    } else {
        siteTreeItem = node.parent.parent;
    }

    // Navigate up the tree to get the site-level information (subscription, location, resource group)
    const wizardContext: IActionContext & Partial<IAppServiceWizardContext> = Object.assign(context, siteTreeItem.subscription, {
        location: siteTreeItem.site.location,
        resourceGroup: { name: siteTreeItem.site.resourceGroup, location: siteTreeItem.site.location },
    });

    // Prompt step: let the user pick an existing App Insights resource or opt to create a new one
    const promptSteps: AzureWizardPromptStep<IAppServiceWizardContext>[] = [
        new AppInsightsListStep(),
    ];
    // Execute steps: create a Log Analytics workspace (required dependency) then the App Insights resource
    const executeSteps: AzureWizardExecuteStep<IAppServiceWizardContext>[] = [
        new LogAnalyticsCreateStep(),
        new AppInsightsCreateStep(),
    ];

    const title: string = localize('attachAppInsights', 'Attach Application Insights');
    const wizard = new AzureWizard(wizardContext, { promptSteps, executeSteps, title });

    // Run the wizard: collect user inputs, then provision the resources
    await wizard.prompt();
    await wizard.execute();

    // Write the connection string to app settings so the web app can communicate with App Insights
    if (wizardContext.appInsightsComponent?.connectionString) {
        const client = await siteTreeItem.site.createClient(context);
        const settings = await client.listApplicationSettings();
        if (settings.properties) {
            settings.properties['APPLICATIONINSIGHTS_CONNECTION_STRING'] = wizardContext.appInsightsComponent.connectionString;
        }
        await client.updateApplicationSettings(settings);
    }

    // Refresh the tree so the "not enabled" node is replaced with the actual App Insights node
    await siteTreeItem.refresh(context);
}

/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { type ApplicationInsightsComponent } from "@azure/arm-appinsights";
import { type AppServicePlan, } from "@azure/arm-appservice";
import { type ResourceGroup } from "@azure/arm-resources";
import { type ILocationWizardContext } from "@microsoft/vscode-azext-azureutils";
import { ActivityChildItem, ActivityChildType, activityInfoContext, activityInfoIcon, AzureWizardPromptStep, createContextValue, type ExecuteActivityContext, type IActionContext } from "@microsoft/vscode-azext-utils";
import { ext } from "../extensionVariables";
import { localize } from "../localize";
import { prependOrInsertAfterLastInfoChild } from "../utils/activityUtils";

type StartingResourcesLogContext = IActionContext & Partial<ExecuteActivityContext> & ILocationWizardContext & {
    resourceGroup?: ResourceGroup,
    plan?: AppServicePlan,
    appInsightsComponent?: ApplicationInsightsComponent,
};

const startingResourcesContext: string = 'startingResourcesLogStepItem';

export class StartingResourcesLogStep<T extends StartingResourcesLogContext> extends AzureWizardPromptStep<T> {
    public hideStepCount: boolean = true;
    protected hasLogged: boolean = false;

    /**
     * Implement if you require additional context loading before resource logging
     */
    protected configureStartingResources?(context: T): void | Promise<void>;

    public async configureBeforePrompt(context: T): Promise<void> {
        if (this.hasLogged) {
            return;
        }
        await this.configureStartingResources?.(context);
        await this.logStartingResources(context);
    }

    public async prompt(): Promise<void> {
        // Don't prompt, just use to log starting resources
    }

    public shouldPrompt(): boolean {
        return false;
    }

    protected async logStartingResources(context: T): Promise<void> {
        if (context.resourceGroup) {
            prependOrInsertAfterLastInfoChild(context,
                new ActivityChildItem({
                    contextValue: createContextValue([startingResourcesContext, activityInfoContext]),
                    label: localize('useResourceGroup', 'Use resource group "{0}"', context.resourceGroup.name),
                    activityType: ActivityChildType.Info,
                    iconPath: activityInfoIcon
                }),
            );
            ext.outputChannel.appendLog(localize('usingResourceGroup', 'Using resource group "{0}".', context.resourceGroup.name));
        }

        if (context.plan) {
            prependOrInsertAfterLastInfoChild(context,
                new ActivityChildItem({
                    contextValue: createContextValue([startingResourcesContext, activityInfoContext]),
                    label: localize('useAppServicePlan', 'Use app service plan "{0}"', context.plan.name),
                    activityType: ActivityChildType.Info,
                    iconPath: activityInfoIcon
                }),
            );
            ext.outputChannel.appendLog(localize('useAppServicePlan', 'Using app service plan "{0}".', context.plan.name));
        }

        if (context.appInsightsComponent) {
            prependOrInsertAfterLastInfoChild(context,
                new ActivityChildItem({
                    contextValue: createContextValue([startingResourcesContext, activityInfoContext]),
                    label: localize('useAppInsights', 'Use application insights "{0}"', context.appInsightsComponent.name),
                    activityType: ActivityChildType.Info,
                    iconPath: activityInfoIcon
                }),
            );
            ext.outputChannel.appendLog(localize('useAppInsights', 'Using application insights "{0}".', context.appInsightsComponent.name));
        }
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type Site } from "@azure/arm-appservice";
import { type IDeployContext } from "@microsoft/vscode-azext-azureappservice";
import { AzExtParentTreeItem, AzureWizard, createSubscriptionContext, nonNullProp, nonNullValueAndProp, type ExecuteActivityContext, type IActionContext, type ISubscriptionContext } from "@microsoft/vscode-azext-utils";
import { type AzureSubscription } from "@microsoft/vscode-azureresources-api";
import { ProgressLocation, window } from "vscode";
import { ext } from "../../extensionVariables";
import { localize } from "../../localize";
import { ResolvedWebAppResource } from "../../tree/ResolvedWebAppResource";
import { SiteTreeItem } from "../../tree/SiteTreeItem";
import { createActivityContext } from "../../utils/activityUtils";
import { SubscriptionListStep } from "../SubscriptionListStep";
import { type IWebAppWizardContext } from "../createWebApp/IWebAppWizardContext";
import { WebAppListStep } from "./WebAppListStep";

export type IWebAppDeployContext = IActionContext & Partial<IDeployContext> & Partial<IWebAppWizardContext> & Partial<ExecuteActivityContext> & {
    site?: Site;
    subscription?: AzureSubscription;
    isNewApp?: boolean;
    advancedCreation?: boolean;
};

export async function getOrCreateWebApp(context: IWebAppDeployContext, subscriptionId?: string): Promise<SiteTreeItem> {
    let node: SiteTreeItem | undefined;

    const activityContext = await createActivityContext();
    Object.assign(context, activityContext);

    const wizard = new AzureWizard<IWebAppDeployContext>(context, {
        promptSteps: [new SubscriptionListStep(subscriptionId), new WebAppListStep()],
        title: localize('selectWebApp', 'Select Web App')
    });

    await wizard.prompt();

    if (context.site) {
        await window.withProgress({ location: ProgressLocation.Notification, cancellable: false, title: localize('deploySetUp', 'Loading deployment configurations...') },
            async () => {
                node = await ext.rgApi.tree.findTreeItem(nonNullValueAndProp(context.site, 'id'), context);
            });
    } else {
        node = undefined;
    }

    // if there was no node, then the user is creating a new web app
    if (!context.site) {
        context.activityTitle = localize('webAppCreateActivityTitle', 'Create Web App "{0}"', nonNullProp(context, 'newSiteName'));
        await wizard.execute();

        const resolved = new ResolvedWebAppResource(context as unknown as ISubscriptionContext, nonNullProp(context, 'site'));
        node = await ext.rgApi.tree.findTreeItem(resolved.id, context);

        await ext.rgApi.tree.refresh(context);

        context.isNewApp = true;
    }

    if (!node) {
        // if we can't find the node for whatever reason, just create one now.
        // context.subscription is AzureSubscription (from SubscriptionListStep), but SiteTreeItem
        // needs ISubscriptionContext with credentials. Convert it before creating the node.
        const subContext = context.subscription
            ? createSubscriptionContext(context.subscription)
            : context as unknown as ISubscriptionContext;
        const pseudoParent = Object.assign({}, context, { subscription: subContext }) as unknown as AzExtParentTreeItem;
        node = new SiteTreeItem(pseudoParent, nonNullProp(context, 'site'));
    }

    if (!node) {
        throw new Error(localize('getOrCreateWebAppFailed', 'Failed to find or create web app "{0}".', context.newSiteName));
    }

    return node;
}

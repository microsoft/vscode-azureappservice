/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppKind, AppServicePlanListStep, CustomLocationListStep, SiteNameStep, WebsiteOS, setLocationsTask } from '@microsoft/vscode-azext-azureappservice';
import { LocationListStep, ResourceGroupListStep, SubscriptionTreeItemBase, VerifyProvidersStep } from '@microsoft/vscode-azext-azureutils';
import { AzureWizard, nonNullProp, type AzureWizardExecuteStep, type AzureWizardPromptStep, type IActionContext } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { webProvider } from '../../constants';
import { ext } from '../../extensionVariables';
import { localize } from '../../localize';
import { createActivityContext } from '../../utils/activityUtils';
import { openUrl } from '../../utils/openUrl';
import { AssignAcrPullRoleStep } from './AssignAcrPullRoleStep';
import { ContainerPortStep } from './ContainerPortStep';
import { CreateWebhookStep } from './CreateWebhookStep';
import { DeployImageCreateStep } from './DeployImageCreateStep';
import { type DeployImageToAppServiceOptionsContract, type IDeployImageWizardContext } from './IDeployImageContext';

export async function deployImageToAppService(context: IActionContext, options: DeployImageToAppServiceOptionsContract): Promise<void> {
    const node = <SubscriptionTreeItemBase>await ext.rgApi.tree.showTreeItemPicker(SubscriptionTreeItemBase.contextValue, context);

    const wizardContext: IDeployImageWizardContext = Object.assign(context, node.subscription, {
        newSiteKind: AppKind.app,
        newSiteOS: WebsiteOS.linux,
        resourceGroupDeferLocationStep: true,
        deployImageOptions: options,
        ...(await createActivityContext({ withChildren: true })),
    });

    await setLocationsTask(wizardContext);

    const promptSteps: AzureWizardPromptStep<IDeployImageWizardContext>[] = [];
    const executeSteps: AzureWizardExecuteStep<IDeployImageWizardContext>[] = [];

    LocationListStep.addStep(wizardContext, promptSteps);
    promptSteps.push(new SiteNameStep());
    promptSteps.push(new ResourceGroupListStep());
    CustomLocationListStep.addStep(wizardContext, promptSteps);
    promptSteps.push(new ContainerPortStep());
    promptSteps.push(new AppServicePlanListStep());

    executeSteps.push(new VerifyProvidersStep([webProvider]));
    executeSteps.push(new DeployImageCreateStep());
    executeSteps.push(new AssignAcrPullRoleStep());
    executeSteps.push(new CreateWebhookStep());

    const title: string = localize('deployImage', 'Deploy Image to Web App');
    const wizard = new AzureWizard<IDeployImageWizardContext>(wizardContext, { promptSteps, executeSteps, title });

    await wizard.prompt();

    const newSiteName = nonNullProp(wizardContext, 'newSiteName');
    wizardContext.activityTitle = localize('deployImageActivity', 'Deploy Image to Web App "{0}"', newSiteName);

    await wizard.execute();
    await ext.rgApi.appResourceTree.refresh(context);

    const site = nonNullProp(wizardContext, 'site');
    const siteUrl = `https://${site.defaultHostName}`;

    ext.outputChannel.appendLog(localize('createdSuccess', 'Successfully created web app "{0}": {1}', newSiteName, siteUrl));

    const browse = localize('browseWebsite', 'Browse Website');
    void vscode.window.showInformationMessage(
        localize('createdWebApp', 'Successfully created web app "{0}".', newSiteName),
        browse,
    ).then(async (result) => {
        if (result === browse) {
            await openUrl(siteUrl);
        }
    });
}

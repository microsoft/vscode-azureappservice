/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Location } from 'azure-arm-resource/lib/subscription/models';
import { WebSiteManagementClient } from 'azure-arm-website';
import { Site, WebAppCollection, AppServicePlan } from 'azure-arm-website/lib/models';
import { workspace, WorkspaceConfiguration, ConfigurationTarget } from 'vscode';
import { AppKind, AppServicePlanCreateStep, AppServicePlanListStep, IAppServiceWizardContext, SiteClient, SiteCreateStep, SiteNameStep, SiteOSStep, SiteRuntimeStep } from 'vscode-azureappservice';
import { AzExtTreeItem, AzureTreeItem, AzureWizard, AzureWizardExecuteStep, AzureWizardPromptStep, createAzureClient, ICreateChildImplContext, parseError, ResourceGroupCreateStep, ResourceGroupListStep, SubscriptionTreeItemBase } from 'vscode-azureextensionui';
import { configurationSettings, extensionPrefix, turnOnAdvancedCreation } from '../constants';
import { nonNullProp, nonNullValue } from '../utils/nonNull';
import { checkPlanForPerformance, getAppServicePlan, setAppWizardContextDefault, isPlanLinux, showPerformancePrompt, getSuffixedName } from './setAppWizardContextDefault';
import { WebAppTreeItem } from './WebAppTreeItem';
import { ext } from '../extensionVariables';

export class SubscriptionTreeItem extends SubscriptionTreeItemBase {
    public readonly childTypeLabel: string = 'Web App';

    private _nextLink: string | undefined;

    public hasMoreChildrenImpl(): boolean {
        return this._nextLink !== undefined;
    }

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<AzExtTreeItem[]> {
        if (clearCache) {
            this._nextLink = undefined;
        }

        const client: WebSiteManagementClient = createAzureClient(this.root, WebSiteManagementClient);

        let webAppCollection: WebAppCollection;
        try {
            webAppCollection = this._nextLink === undefined ?
                await client.webApps.list() :
                await client.webApps.listNext(this._nextLink);
        } catch (error) {
            if (parseError(error).errorType.toLowerCase() === 'notfound') {
                // This error type means the 'Microsoft.Web' provider has not been registered in this subscription
                // In that case, we know there are no web apps, so we can return an empty array
                // (The provider will be registered automatically if the user creates a new web app)
                return [];
            } else {
                throw error;
            }
        }

        this._nextLink = webAppCollection.nextLink;

        return await this.createTreeItemsWithErrorHandling(
            webAppCollection,
            'invalidAppService',
            (s: Site) => {
                const siteClient: SiteClient = new SiteClient(s, this.root);
                return siteClient.isFunctionApp ? undefined : new WebAppTreeItem(this, siteClient);
            },
            (s: Site) => {
                return s.name;
            }
        );
    }

    public async createChildImpl(context: ICreateChildImplContext): Promise<AzureTreeItem> {
        const wizardContext: IAppServiceWizardContext = Object.assign(context, this.root, {
            newSiteKind: AppKind.app,
            resourceGroupDeferLocationStep: true
        });

        await setAppWizardContextDefault(wizardContext);

        const promptSteps: AzureWizardPromptStep<IAppServiceWizardContext>[] = [];
        const executeSteps: AzureWizardExecuteStep<IAppServiceWizardContext>[] = [];

        promptSteps.push(new SiteNameStep());

        const workspaceConfig: WorkspaceConfiguration = workspace.getConfiguration(extensionPrefix);
        const advancedCreation: boolean | undefined = workspaceConfig.get(configurationSettings.advancedCreation);
        if (advancedCreation) {
            promptSteps.push(new ResourceGroupListStep());
            promptSteps.push(new SiteOSStep());
            promptSteps.push(new SiteRuntimeStep());
            promptSteps.push(new AppServicePlanListStep());
        } else {
            promptSteps.push(new SiteOSStep()); // will be skipped if there is a smart default
            promptSteps.push(new SiteRuntimeStep());
            executeSteps.push(new ResourceGroupCreateStep());
            executeSteps.push(new AppServicePlanCreateStep());
        }
        executeSteps.push(new SiteCreateStep());

        if (wizardContext.newSiteOS !== undefined) {
            SiteOSStep.setLocationsTask(wizardContext);
        }

        const title: string = 'Create new web app';
        const wizard: AzureWizard<IAppServiceWizardContext> = new AzureWizard(wizardContext, { promptSteps, executeSteps, title });

        await wizard.prompt();

        context.showCreatingTreeItem(nonNullProp(wizardContext, 'newSiteName'));

        if (!advancedCreation) {
            // this should always be set when in the basic creation scenario
            const location: Location = nonNullValue(wizardContext, 'location');
            wizardContext.newResourceGroupName = `appsvc_rg_${wizardContext.newSiteOS}_${location.name}`;
            wizardContext.newPlanName = `appsvc_asp_${wizardContext.newSiteOS}_${location.name}`;

            const asp: AppServicePlan | null = await getAppServicePlan(wizardContext, wizardContext.newPlanName);
            if (asp && checkPlanForPerformance(asp)) {
                // Subscriptions can only have 1 free tier Linux plan so show the warning if there are too many apps on the plan

                context.telemetry.properties.performanceWarning = 'true';
                if (!isPlanLinux(asp)) {
                    const showPerfWarning: boolean | undefined = workspaceConfig.get(configurationSettings.showPlanPerformanceWarning);
                    if (showPerfWarning) {
                        await showPerformancePrompt(context, asp);
                    }
                } else {
                    // Subscriptions can have 10 free tier Windows plans so just create a new one with a suffixed name
                    // If there are 10 plans, it'll throw an error that directs them to advancedCreation
                    wizardContext.newPlanName = await getSuffixedName(wizardContext, wizardContext.newPlanName);
                }
            }
        }

        try {
            await wizard.execute();
        } catch (error) {
            // if there is an error when creating, prompt the user to try advanced creation
            if (!parseError(error).isUserCancelledError && !advancedCreation) {
                const message: string = `Modify the setting "${extensionPrefix}.${configurationSettings.advancedCreation}" if you want to change the default values when creating a Web App in Azure.`;

                // tslint:disable-next-line: no-floating-promises
                ext.ui.showWarningMessage(message, turnOnAdvancedCreation).then(async result => {
                    if (result === turnOnAdvancedCreation) {
                        await workspaceConfig.update('advancedCreation', true, ConfigurationTarget.Global);
                    }
                });
            }
            throw error;
        }

        context.telemetry.properties.os = wizardContext.newSiteOS;
        context.telemetry.properties.runtime = wizardContext.newSiteRuntime;
        context.telemetry.properties.advancedCreation = advancedCreation ? 'true' : 'false';

        // site is set as a result of SiteCreateStep.execute()
        const siteClient: SiteClient = new SiteClient(nonNullProp(wizardContext, 'site'), this.root);

        return new WebAppTreeItem(this, siteClient);
    }
}

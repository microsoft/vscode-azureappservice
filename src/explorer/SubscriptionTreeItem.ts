/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient } from 'azure-arm-website';
import { Site, WebAppCollection } from 'azure-arm-website/lib/models';
import { AppInsightsCreateStep, AppInsightsListStep, AppKind, AppServicePlanCreateStep, AppServicePlanListStep, IAppServiceWizardContext, setLocationsTask, SiteClient, SiteNameStep, SiteOSStep, SiteRuntimeStep } from 'vscode-azureappservice';
import { AzExtTreeItem, AzureTreeItem, AzureWizard, AzureWizardExecuteStep, AzureWizardPromptStep, createAzureClient, ICreateChildImplContext, LocationListStep, parseError, ResourceGroupCreateStep, ResourceGroupListStep, SubscriptionTreeItemBase, VerifyProvidersStep } from 'vscode-azureextensionui';
import { setPostPromptDefaults } from '../commands/createWebApp/setPostPromptDefaults';
import { setPrePromptDefaults } from '../commands/createWebApp/setPrePromptDefaults';
import { getCreatedWebAppMessage } from '../commands/createWebApp/showCreatedWebAppMessage';
import { WebAppCreateStep } from '../commands/createWebApp/WebAppCreateStep';
import { ext } from '../extensionVariables';
import { nonNullProp } from '../utils/nonNull';
import { WebAppTreeItem } from './WebAppTreeItem';

export class SubscriptionTreeItem extends SubscriptionTreeItemBase {
    public readonly childTypeLabel: string = 'Web App';
    public supportsAdvancedCreation: boolean = true;

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

        await setPrePromptDefaults(wizardContext);

        const promptSteps: AzureWizardPromptStep<IAppServiceWizardContext>[] = [];
        const executeSteps: AzureWizardExecuteStep<IAppServiceWizardContext>[] = [];
        const siteStep: SiteNameStep = new SiteNameStep();
        promptSteps.push(siteStep);

        if (context.advancedCreation) {
            promptSteps.push(new ResourceGroupListStep());
            promptSteps.push(new SiteOSStep());
            promptSteps.push(new SiteRuntimeStep());
            promptSteps.push(new AppServicePlanListStep());
            promptSteps.push(new AppInsightsListStep());
        } else {
            promptSteps.push(new SiteOSStep()); // will be skipped if there is a smart default
            promptSteps.push(new SiteRuntimeStep());
            executeSteps.push(new ResourceGroupCreateStep());
            executeSteps.push(new AppServicePlanCreateStep());
            executeSteps.push(new AppInsightsCreateStep());
        }
        LocationListStep.addStep(wizardContext, promptSteps);

        executeSteps.push(new VerifyProvidersStep(['Microsoft.Web', 'Microsoft.Insights']));
        executeSteps.push(new WebAppCreateStep());

        if (wizardContext.newSiteOS !== undefined) {
            setLocationsTask(wizardContext);
        }

        const title: string = 'Create new web app';
        const wizard: AzureWizard<IAppServiceWizardContext> = new AzureWizard(wizardContext, { promptSteps, executeSteps, title });

        await wizard.prompt();

        context.showCreatingTreeItem(nonNullProp(wizardContext, 'newSiteName'));

        if (!context.advancedCreation) {
            await setPostPromptDefaults(wizardContext, siteStep);
            wizardContext.newAppInsightsName = await wizardContext.relatedNameTask;
            if (!wizardContext.newAppInsightsName) {
                throw new Error('Failed to generate unique name for resources. Use advanced creation to manually enter resource names.');
            }
        }

        await wizard.execute();

        // site is set as a result of SiteCreateStep.execute()
        const siteClient: SiteClient = new SiteClient(nonNullProp(wizardContext, 'site'), this.root);
        ext.outputChannel.appendLog(getCreatedWebAppMessage(siteClient));

        const newSite: WebAppTreeItem = new WebAppTreeItem(this, siteClient);
        try {
            // enable HTTP logs by default
            await newSite.enableHttpLogs();
        } catch (error) {
            // optional part of creating web app, so not worth blocking on error
            context.telemetry.properties.fileLoggingError = parseError(error).message;
        }
        return newSite;
    }
}

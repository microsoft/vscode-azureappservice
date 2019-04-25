/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Location } from 'azure-arm-resource/lib/subscription/models';
import { WebSiteManagementClient } from 'azure-arm-website';
import { Site, WebAppCollection } from 'azure-arm-website/lib/models';
import * as appservice from 'vscode-azureappservice';
import * as extensionui from 'vscode-azureextensionui';
import { WebAppTreeItem } from './WebAppTreeItem';

export class WebAppProvider extends extensionui.SubscriptionTreeItem {
    public readonly childTypeLabel: string = 'Web App';

    private _nextLink: string | undefined;

    public hasMoreChildrenImpl(): boolean {
        return this._nextLink !== undefined;
    }

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<extensionui.AzureTreeItem[]> {
        if (clearCache) {
            this._nextLink = undefined;
        }

        const client: WebSiteManagementClient = extensionui.createAzureClient(this.root, WebSiteManagementClient);

        let webAppCollection: WebAppCollection;
        try {
            webAppCollection = this._nextLink === undefined ?
                await client.webApps.list() :
                await client.webApps.listNext(this._nextLink);
        } catch (error) {
            if (extensionui.parseError(error).errorType.toLowerCase() === 'notfound') {
                // This error type means the 'Microsoft.Web' provider has not been registered in this subscription
                // In that case, we know there are no web apps, so we can return an empty array
                // (The provider will be registered automatically if the user creates a new web app)
                return [];
            } else {
                throw error;
            }
        }

        this._nextLink = webAppCollection.nextLink;

        return await extensionui.createTreeItemsWithErrorHandling(
            this,
            webAppCollection,
            'invalidAppService',
            (s: Site) => {
                const siteClient: appservice.SiteClient = new appservice.SiteClient(s, this.root);
                return siteClient.isFunctionApp ? undefined : new WebAppTreeItem(this, siteClient);
            },
            (s: Site) => {
                return s.name;
            }
        );
    }

    public async createChildImpl(showCreatingTreeItem: (label: string) => void, createOptions?: appservice.IAppCreateOptions): Promise<extensionui.AzureTreeItem> {
        // tslint:disable-next-line:strict-boolean-expressions
        createOptions = createOptions || {};

        // Ideally actionContext should always be defined, but there's a bug with the TreeItemPicker. Create a 'fake' actionContext until that bug is fixed
        // https://github.com/Microsoft/vscode-azuretools/issues/120
        // tslint:disable-next-line strict-boolean-expressions
        const actionContext: extensionui.IActionContext = createOptions.actionContext || { properties: {}, measurements: {} };

        const promptSteps: extensionui.AzureWizardPromptStep<appservice.IAppServiceWizardContext>[] = [];
        const executeSteps: extensionui.AzureWizardExecuteStep<appservice.IAppServiceWizardContext>[] = [];
        const wizardContext: appservice.IAppServiceWizardContext = {
            newSiteKind: appservice.AppKind.app,
            newSiteOS: createOptions.os ? appservice.WebsiteOS[createOptions.os] : undefined,
            newSiteRuntime: createOptions.runtime,
            subscriptionId: this.root.subscriptionId,
            subscriptionDisplayName: this.root.subscriptionDisplayName,
            credentials: this.root.credentials,
            environment: this.root.environment,
            newResourceGroupName: createOptions.resourceGroup,
            resourceGroupDeferLocationStep: true,
            recommendedSiteRuntime: createOptions.recommendedSiteRuntime,
            newPlanSku: createOptions.planSku
        };

        promptSteps.push(new appservice.SiteNameStep());
        if (createOptions.advancedCreation) {
            promptSteps.push(new extensionui.ResourceGroupListStep());
            promptSteps.push(new appservice.SiteOSStep());
            promptSteps.push(new appservice.SiteRuntimeStep());
            promptSteps.push(new appservice.AppServicePlanListStep());
        } else {
            promptSteps.push(new appservice.SiteOSStep()); // will be skipped if there is a smart default
            promptSteps.push(new appservice.SiteRuntimeStep());
            executeSteps.push(new extensionui.ResourceGroupCreateStep());
            executeSteps.push(new appservice.AppServicePlanCreateStep());
        }
        executeSteps.push(new appservice.SiteCreateStep());

        if (wizardContext.newSiteOS !== undefined) {
            appservice.SiteOSStep.setLocationsTask(wizardContext);
        }

        const title: string = 'Create new web app';
        const wizard: extensionui.AzureWizard<appservice.IAppServiceWizardContext> = new extensionui.AzureWizard(wizardContext, { promptSteps, executeSteps, title });

        await wizard.prompt(actionContext);
        // tslint:disable-next-line strict-boolean-expressions
        if (showCreatingTreeItem) {
            // tslint:disable-next-line no-non-null-assertion
            showCreatingTreeItem(wizardContext.newSiteName!);
        }
        if (!createOptions.advancedCreation) {
            if (createOptions.location) {
                // this should always be set when in the basic creation scenario
                await extensionui.LocationListStep.setLocation(wizardContext, createOptions.location);
            }

            // tslint:disable-next-line no-non-null-assertion
            const location: Location = wizardContext.location!;
            wizardContext.newResourceGroupName = `appsvc_rg_${wizardContext.newSiteOS}_${location.name}`;
            wizardContext.newPlanName = `appsvc_asp_${wizardContext.newSiteOS}_${location.name}`;
        }

        await wizard.execute(actionContext);

        actionContext.properties.os = wizardContext.newSiteOS;
        actionContext.properties.runtime = wizardContext.newSiteRuntime;
        actionContext.properties.advancedCreation = createOptions.advancedCreation ? 'true' : 'false';

        // site is set as a result of SiteCreateStep.execute()
        // tslint:disable-next-line no-non-null-assertion
        const siteClient: appservice.SiteClient = new appservice.SiteClient(wizardContext.site!, this.root);
        return new WebAppTreeItem(this, siteClient);
    }
}

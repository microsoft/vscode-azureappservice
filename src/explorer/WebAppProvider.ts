/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Location } from 'azure-arm-resource/lib/subscription/models';
import { WebSiteManagementClient } from 'azure-arm-website';
import { Site, WebAppCollection } from 'azure-arm-website/lib/models';
import { workspace, WorkspaceConfiguration } from 'vscode';
import { AppKind, AppServicePlanCreateStep, AppServicePlanListStep, IAppServiceWizardContext, SiteClient, SiteCreateStep, SiteNameStep, SiteOSStep, SiteRuntimeStep } from 'vscode-azureappservice';
import { AzureTreeItem, AzureWizard, AzureWizardExecuteStep, AzureWizardPromptStep, createAzureClient, createTreeItemsWithErrorHandling, IActionContext, parseError, ResourceGroupCreateStep, ResourceGroupListStep, SubscriptionTreeItem } from 'vscode-azureextensionui';
import { configurationSettings, extensionPrefix } from '../constants';
import { setAppWizardContextDefault } from './setAppWizardContextDefault';
import { WebAppTreeItem } from './WebAppTreeItem';

export class WebAppProvider extends SubscriptionTreeItem {
    public readonly childTypeLabel: string = 'Web App';

    private _nextLink: string | undefined;

    public hasMoreChildrenImpl(): boolean {
        return this._nextLink !== undefined;
    }

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<AzureTreeItem[]> {
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

        return await createTreeItemsWithErrorHandling(
            this,
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

    public async createChildImpl(showCreatingTreeItem: (label: string) => void, actionContext?: IActionContext): Promise<AzureTreeItem> {
        // Ideally actionContext should always be defined, but there's a bug with the TreeItemPicker. Create a 'fake' actionContext until that bug is fixed
        // https://github.com/Microsoft/vscode-azuretools/issues/120
        // tslint:disable-next-line strict-boolean-expressions
        actionContext = actionContext || { properties: {}, measurements: {} };
        const wizardContext: IAppServiceWizardContext = {
            newSiteKind: AppKind.app,
            subscriptionId: this.root.subscriptionId,
            subscriptionDisplayName: this.root.subscriptionDisplayName,
            credentials: this.root.credentials,
            environment: this.root.environment
        };

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

        await wizard.prompt(actionContext);

        // tslint:disable-next-line no-non-null-assertion
        showCreatingTreeItem(wizardContext.newSiteName!);

        if (!advancedCreation) {
            // this should always be set when in the basic creation scenario
            // tslint:disable-next-line no-non-null-assertion
            const location: Location = wizardContext.location!;
            wizardContext.newResourceGroupName = `appsvc_rg_${wizardContext.newSiteOS}_${location.name}`;
            wizardContext.newPlanName = `appsvc_asp_${wizardContext.newSiteOS}_${location.name}`;
        }

        await wizard.execute(actionContext);

        actionContext.properties.os = wizardContext.newSiteOS;
        actionContext.properties.runtime = wizardContext.newSiteRuntime;
        actionContext.properties.advancedCreation = advancedCreation ? 'true' : 'false';

        // site is set as a result of SiteCreateStep.execute()
        // tslint:disable-next-line no-non-null-assertion
        const siteClient: SiteClient = new SiteClient(wizardContext.site!, this.root);
        return new WebAppTreeItem(this, siteClient);
    }
}

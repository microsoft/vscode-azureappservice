/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AzureAccountWrapper } from './azureAccountWrapper';
import { WizardBase, WizardResult, WizardStep, SubscriptionStepBase, QuickPickItemWithData } from './wizard';
import { SubscriptionModels, ResourceManagementClient, ResourceModels } from 'azure-arm-resource';
import { UserCancelledError, WizardFailedError } from './errors';
import WebSiteManagementClient = require('azure-arm-website');
import * as WebSiteModels from '../node_modules/azure-arm-website/lib/models';
import * as util from './util';

export class WebAppCreator extends WizardBase {
    constructor(output: vscode.OutputChannel, readonly azureAccount: AzureAccountWrapper, subscription: SubscriptionModels.Subscription, persistence?: vscode.Memento) {
        super(output);
        this.steps.push(new SubscriptionStep(this, azureAccount, subscription, persistence));
        this.steps.push(new WebsiteNameStep(this, azureAccount, persistence));
        this.steps.push(new ResourceGroupStep(this, azureAccount, persistence));
        this.steps.push(new AppServicePlanStep(this, azureAccount, persistence));
        this.steps.push(new WebsiteStep(this, azureAccount, persistence));
    }

    async run(promptOnly = false): Promise<WizardResult> {
        // If not signed in, execute the sign in command and wait for it...
        if (this.azureAccount.signInStatus !== 'LoggedIn') {
            await vscode.commands.executeCommand(util.getSignInCommandString());
        }
        // Now check again, if still not signed in, cancel.
        if (this.azureAccount.signInStatus !== 'LoggedIn') {
            return {
                status: 'Cancelled',
                step: this.steps[0],
                error: null
            };
        }

        return super.run(promptOnly);
    }

    get createdWebSite(): WebSiteModels.Site {
        return this.findStepOfType(WebsiteStep).website;
    }

    protected beforeExecute(_step: WizardStep, stepIndex: number) {
        if (stepIndex == 0) {
            this.writeline('Start creating new Web App...');
        }
    }

    protected onRunError(error: Error, step: WizardStep) {
        if (error instanceof UserCancelledError) {
            return;
        }
        throw new WizardFailedError(error, step.stepTitle, step.stepIndex);
    }

    protected onExecuteError(error: Error, step: WizardStep) {
        if (error instanceof UserCancelledError) {
            return;
        }
        this.writeline(`Failed to create new Web App - ${error.message}`);
        this.writeline('');
        throw new WizardFailedError(error, step.stepTitle, step.stepIndex);
    }
}

class WebAppCreatorStepBase extends WizardStep {
    protected constructor(wizard: WizardBase, stepTitle: string, readonly azureAccount: AzureAccountWrapper, persistence: vscode.Memento) {
        super(wizard, stepTitle, persistence);
    }

    protected getSuggestedRGAndPlanName(): string {
        var suggestedRGAndPlanName = this.wizard.findStepOfType(WebsiteNameStep).suggestedRGAndPlanName;
        if (!suggestedRGAndPlanName) {
            throw new Error('A website name must be entered first.');
        }

        return suggestedRGAndPlanName;
    }

    protected getSelectedSubscription(): SubscriptionModels.Subscription {
        const subscriptionStep = this.wizard.findStepOfType(SubscriptionStep);

        if (!subscriptionStep.subscription) {
            throw new Error('A subscription must be selected first.');
        }

        return subscriptionStep.subscription;
    }

    protected getSelectedResourceGroup(): ResourceModels.ResourceGroup {
        const resourceGroupStep = this.wizard.findStepOfType(ResourceGroupStep);

        if (!resourceGroupStep.resourceGroup) {
            throw new Error('A resource group must be selected first.');
        }

        return resourceGroupStep.resourceGroup;
    }

    protected getSelectedAppServicePlan(): WebSiteModels.AppServicePlan {
        const appServicePlanStep = this.wizard.findStepOfType(AppServicePlanStep);

        if (!appServicePlanStep.servicePlan) {
            throw new Error('An App Service Plan must be selected first.');
        }

        return appServicePlanStep.servicePlan;
    }

    protected getWebsiteName(): string {
        const siteName = this.wizard.findStepOfType(WebsiteNameStep).websiteName;
        if (!siteName) {
            throw new Error('A website name must be entered first.');
        }

        return siteName;
    }
}

class SubscriptionStep extends SubscriptionStepBase {
    constructor(wizard: WizardBase, azureAccount: AzureAccountWrapper, subscription?: SubscriptionModels.Subscription, persistence?: vscode.Memento) {
        super(wizard, 'Select subscription', azureAccount, subscription, persistence);
    }

    async prompt(): Promise<void> {
        if (!!this.subscription) {
            return;
        }

        const quickPickItems = this.getSubscriptionsAsQuickPickItems();
        const quickPickOptions = { placeHolder: `Select the subscription to create the new Web App in. (${this.stepProgressText})` };
        const result = await this.showQuickPick(quickPickItems, quickPickOptions, "NewWebApp.Subscription");
        this._subscription = result.data;
    }

    async execute(): Promise<void> {
        this.wizard.writeline(`The new Web App will be created in subscription "${this.subscription.displayName}" (${this.subscription.subscriptionId}).`);
    }
}

class ResourceGroupStep extends WebAppCreatorStepBase {
    private _createNew: boolean;
    private _rg: ResourceModels.ResourceGroup;

    constructor(wizard: WizardBase, azureAccount: AzureAccountWrapper, persistence?: vscode.Memento) {
        super(wizard, 'Select or create resource group', azureAccount, persistence);
    }

    async prompt(): Promise<void> {
        const createNewItem: QuickPickItemWithData<ResourceModels.ResourceGroup> = {
            persistenceId: "",
            label: '$(plus) Create New Resource Group',
            description: null,
            data: null
        };
        const quickPickOptions = { placeHolder: `Select the resource group to create the new Web App in. (${this.stepProgressText})` };
        const subscription = this.getSelectedSubscription();
        const resourceClient = new ResourceManagementClient(this.azureAccount.getCredentialByTenantId(subscription.tenantId), subscription.subscriptionId);
        var resourceGroups: ResourceModels.ResourceGroup[];
        const resourceGroupsTask = util.listAll(resourceClient.resourceGroups, resourceClient.resourceGroups.list());
        var locationsTask = this.azureAccount.getLocationsBySubscription(this.getSelectedSubscription());
        var locations: SubscriptionModels.Location[];
        var newRgName: string;
        var suggestedName = this.getSuggestedRGAndPlanName();

        const quickPickItemsTask = Promise.all([resourceGroupsTask, locationsTask]).then(results => {
            const quickPickItems: QuickPickItemWithData<ResourceModels.ResourceGroup>[] = [createNewItem];
            resourceGroups = results[0];
            locations = results[1];
            resourceGroups.forEach(rg => {
                quickPickItems.push({
                    persistenceId: rg.id,
                    label: rg.name,
                    description: `(${locations.find(l => l.name.toLowerCase() === rg.location.toLowerCase()).displayName})`,
                    detail: '',
                    data: rg
                });
            });

            return quickPickItems;
        });

        // Cache resource group separately per subscription
        const result = await this.showQuickPick(quickPickItemsTask, quickPickOptions, `"NewWebApp.ResourceGroup/${subscription.id}`);

        if (result.data) {
            this._createNew = false;
            this._rg = result.data;
            return;
        }

        this._createNew = true;
        newRgName = await this.showInputBox({
            value: suggestedName,
            prompt: 'Enter the name of the new resource group.',
            validateInput: (value: string) => {
                value = value ? value.trim() : '';

                if (resourceGroups.findIndex(rg => rg.name.localeCompare(value) === 0) >= 0) {
                    return `Resource group name "${value}" already exists.`;
                }

                if (!value.match(/^[a-z0-9.\-_()]{0,89}[a-z0-9\-_()]$/ig)) {
                    return 'Resource group name should be 1-90 characters long and can only include alphanumeric characters, periods, ' +
                        'underscores, hyphens and parenthesis and cannot end in a period.';
                }

                return null;
            }
        });

        const locationPickItems = locations.map<QuickPickItemWithData<SubscriptionModels.Location>>(location => {
            return {
                label: location.displayName,
                description: `(${location.name})`,
                detail: '',
                persistenceId: location.name,
                data: location
            };
        });
        const locationPickOptions = { placeHolder: 'Select the location of the new resource group.' };
        const pickedLocation = await this.showQuickPick(locationPickItems, locationPickOptions, "NewWebApp.Location");

        this._rg = {
            name: newRgName.trim(),
            location: pickedLocation.data.name
        }
    }

    async execute(): Promise<void> {
        if (!this._createNew) {
            this.wizard.writeline(`Existing resource group "${this._rg.name} (${this._rg.location})" will be used.`);
            return;
        }

        this.wizard.writeline(`Creating new resource group "${this._rg.name} (${this._rg.location})"...`);
        const subscription = this.getSelectedSubscription();
        const resourceClient = new ResourceManagementClient(this.azureAccount.getCredentialByTenantId(subscription.tenantId), subscription.subscriptionId);
        this._rg = await resourceClient.resourceGroups.createOrUpdate(this._rg.name, this._rg);
        this.wizard.writeline(`Resource group created.`);
    }

    get resourceGroup(): ResourceModels.ResourceGroup {
        return this._rg;
    }

    get createNew(): boolean {
        return this._createNew;
    }
}

class AppServicePlanStep extends WebAppCreatorStepBase {
    private _createNew: boolean;
    private _plan: WebSiteModels.AppServicePlan;

    constructor(wizard: WizardBase, azureAccount: AzureAccountWrapper, persistence: vscode.Memento) {
        super(wizard, 'Select or create App Service Plan', azureAccount, persistence);
    }

    async prompt(): Promise<void> {
        const createNewItem: QuickPickItemWithData<WebSiteModels.AppServicePlan> = {
            persistenceId: "$new",
            label: '$(plus) Create New App Service Plan',
            description: '',
            data: this._plan
        };
        const quickPickOptions = { placeHolder: `Select the App Service Plan for the new Web App. (${this.stepProgressText}) ` };
        const subscription = this.getSelectedSubscription();
        const client = new WebSiteManagementClient(this.azureAccount.getCredentialByTenantId(subscription.tenantId), subscription.subscriptionId);
        // You can create a web app and associate it with a plan from another resource group.
        // That's why we use list instead of listByResourceGroup below; and show resource group name in the quick pick list.

        let plans: WebSiteModels.AppServicePlan[];
        const plansTask = util.listAll(client.appServicePlans, client.appServicePlans.list()).then(result => {
            const quickPickItems = [createNewItem];
            plans = result;
            plans.forEach(plan => {
                // Currently we only support Linux web apps.
                if (plan.kind.toLowerCase() === 'linux') {
                    quickPickItems.push({
                        persistenceId: plan.id,
                        label: plan.appServicePlanName,
                        description: `${plan.sku.name} (${plan.geoRegion})`,
                        detail: plan.resourceGroup,
                        data: plan
                    });
                }
            });

            return quickPickItems;
        });

        const rg = this.getSelectedResourceGroup();
        const suggestedName = this.getSuggestedRGAndPlanName();
        var newPlanName: string;

        // Cache hosting plan separately per subscription
        const pickedItem = await this.showQuickPick(plansTask, quickPickOptions, `NewWebApp.HostingPlan/${subscription.id}`);

        if (pickedItem !== createNewItem) {
            this._createNew = false;
            this._plan = pickedItem.data;
            return;
        }

        // Prompt for new plan information.
        newPlanName = await this.showInputBox({
            value: suggestedName,
            prompt: 'Enter the name of the new App Service Plan.',
            validateInput: (value: string) => {
                value = value ? value.trim() : '';

                if (plans.findIndex(plan => plan.resourceGroup.toLowerCase() === rg.name && value.localeCompare(plan.name) === 0) >= 0) {
                    return `App Service Plan name "${value}" already exists in resource group "${rg.name}".`;
                }

                if (!value.match(/^[a-z0-9\-]{1,40}$/ig)) {
                    return 'App Service Plan name should be 1-40 characters long and can only include alphanumeric characters and hyphens.';
                }

                return null;
            }
        });

        // Prompt for Pricing tier
        const pricingTiers: QuickPickItemWithData<WebSiteModels.SkuDescription>[] = [];
        const availableSkus = this.getPlanSkus();
        availableSkus.forEach(sku => {
            pricingTiers.push({
                persistenceId: sku.name,
                label: sku.name,
                description: sku.tier,
                detail: '',
                data: sku
            });
        });
        const pickedSkuItem = await this.showQuickPick(pricingTiers, { placeHolder: 'Choose your pricing tier.' }, "NewWebApp.PricingTier");
        const newPlanSku = pickedSkuItem.data;
        this._createNew = true;
        this._plan = {
            appServicePlanName: newPlanName.trim(),
            kind: 'linux',  // Currently we only support Linux web apps.
            sku: newPlanSku,
            location: rg.location,
            reserved: true  // The secret property - must be set to true to make it a Linux plan. Confirmed by the team who owns this API.
        };
    }

    async execute(): Promise<void> {
        if (!this._createNew) {
            this.wizard.writeline(`Existing App Service Plan "${this._plan.appServicePlanName} (${this._plan.sku.name})" will be used.`);
            return;
        }

        this.wizard.writeline(`Creating new App Service Plan "${this._plan.appServicePlanName} (${this._plan.sku.name})"...`);
        const subscription = this.getSelectedSubscription();
        const rg = this.getSelectedResourceGroup();
        const websiteClient = new WebSiteManagementClient(this.azureAccount.getCredentialByTenantId(subscription.tenantId), subscription.subscriptionId);
        this._plan = await websiteClient.appServicePlans.createOrUpdate(rg.name, this._plan.appServicePlanName, this._plan);
        this.wizard.writeline(`App Service Plan created.`);
    }

    get servicePlan(): WebSiteModels.AppServicePlan {
        return this._plan;
    }

    get createNew(): boolean {
        return this._createNew;
    }

    private getPlanSkus(): WebSiteModels.SkuDescription[] {
        return [
            {
                name: 'S1',
                tier: 'Standard',
                size: 'S1',
                family: 'S',
                capacity: 1
            },
            {
                name: 'S2',
                tier: 'Standard',
                size: 'S2',
                family: 'S',
                capacity: 1
            },
            {
                name: 'S3',
                tier: 'Standard',
                size: 'S3',
                family: 'S',
                capacity: 1
            },
            {
                name: 'B1',
                tier: 'Basic',
                size: 'B1',
                family: 'B',
                capacity: 1
            },
            {
                name: 'B2',
                tier: 'Basic',
                size: 'B2',
                family: 'B',
                capacity: 1
            },
            {
                name: 'B3',
                tier: 'Basic',
                size: 'B3',
                family: 'B',
                capacity: 1
            }
        ];
    }
}

class WebsiteStep extends WebAppCreatorStepBase {
    private _website: WebSiteModels.Site;

    constructor(wizard: WizardBase, azureAccount: AzureAccountWrapper, persistence?: vscode.Memento) {
        super(wizard, 'Create Web App', azureAccount, persistence);
    }

    async prompt(): Promise<void> {
        const siteName = this.getWebsiteName();

        var runtimeStack: string;
        const runtimeItems: QuickPickItemWithData<LinuxRuntimeStack>[] = [];
        const linuxRuntimeStacks = this.getLinuxRuntimeStack();

        linuxRuntimeStacks.forEach(rt => {
            runtimeItems.push({
                persistenceId: rt.name,
                label: rt.displayName,
                description: '',
                data: rt
            });
        });

        const pickedItem = await this.showQuickPick(runtimeItems, { placeHolder: 'Select runtime stack.' }, "NewWebApp.RuntimeStack");
        runtimeStack = pickedItem.data.name;

        const rg = this.getSelectedResourceGroup();
        const plan = this.getSelectedAppServicePlan();

        this._website = {
            name: siteName,
            kind: 'app,linux',
            location: rg.location,
            serverFarmId: plan.id,
            siteConfig: {
                linuxFxVersion: runtimeStack
            }
        }
    }

    async execute(): Promise<void> {
        this.wizard.writeline(`Creating new Web App "${this._website.name}"...`);
        const subscription = this.getSelectedSubscription();
        const rg = this.getSelectedResourceGroup();
        const websiteClient = new WebSiteManagementClient(this.azureAccount.getCredentialByTenantId(subscription.tenantId), subscription.subscriptionId);

        // If the plan is also newly created, its resource ID won't be available at this step's prompt stage, but should be available now.
        if (!this._website.serverFarmId) {
            this._website.serverFarmId = this.getSelectedAppServicePlan().id;
        }

        this._website = await websiteClient.webApps.createOrUpdate(rg.name, this._website.name, this._website);
        this._website.siteConfig = await websiteClient.webApps.getConfiguration(rg.name, this._website.name);

        this.wizard.writeline(`Web App "${this._website.name}" created: https://${this._website.defaultHostName}`);
        this.wizard.writeline('');
    }

    get website(): WebSiteModels.Site {
        return this._website;
    }

    private getLinuxRuntimeStack(): LinuxRuntimeStack[] {
        return [
            {
                name: 'node|4.4',
                displayName: 'Node.js 4.4'
            },
            {
                name: 'node|4.5',
                displayName: 'Node.js 4.5'
            },
            {
                name: 'node|6.2',
                displayName: 'Node.js 6.2'
            },
            {
                name: 'node|6.6',
                displayName: 'Node.js 6.6'
            },
            {
                name: 'node|6.9',
                displayName: 'Node.js 6.9'
            },
            {
                name: 'node|6.10',
                displayName: 'Node.js 6.10'
            },
            {
                name: 'node|6.11',
                displayName: 'Node.js 6.11 (LTS - Recommended for new Web Apps)'
            },
            {
                name: 'node|8.0',
                displayName: 'Node.js 8.0'
            },
            {
                name: 'node|8.1',
                displayName: 'Node.js 8.1'
            }
        ];
    }
}

class WebsiteNameStep extends WebAppCreatorStepBase {
    private _websiteName: string;
    private _suggestedRGAndPlanName: string;

    constructor(wizard: WizardBase, azureAccount: AzureAccountWrapper, persistence?: vscode.Memento) {
        super(wizard, 'Create Web App', azureAccount, persistence);
    }

    async prompt(): Promise<void> {
        const subscription = this.getSelectedSubscription();
        const client = new WebSiteManagementClient(this.azureAccount.getCredentialByTenantId(subscription.tenantId), subscription.subscriptionId);
        let siteName: string;
        let siteNameOkay = false;

        while (!siteNameOkay) {
            siteName = await this.showInputBox({
                prompt: `Enter a globally unique name for the new Web App. (${this.stepProgressText})`,
                validateInput: (value: string) => {
                    value = value ? value.trim() : '';

                    if (!value.match(/^[a-z0-9\-]{1,60}$/ig)) {
                        return 'App name should be 1-60 characters long and can only include alphanumeric characters and hyphens.';
                    }

                    return null;
                }
            });
            siteName = siteName.trim();

            // Check if the name has already been taken...
            const nameAvailability = await client.checkNameAvailability(siteName, 'site');
            siteNameOkay = nameAvailability.nameAvailable;

            if (!siteNameOkay) {
                await vscode.window.showWarningMessage(nameAvailability.message);
            }
        }

        this._websiteName = siteName;
        this._suggestedRGAndPlanName = await this.suggestRGAndPlanPName(siteName);
    }

    private async suggestRGAndPlanPName(siteName: string): Promise<string> {
        const subscription = this.getSelectedSubscription();
        const resourceClient = new ResourceManagementClient(this.azureAccount.getCredentialByTenantId(subscription.tenantId), subscription.subscriptionId);
        const webSiteClient = new WebSiteManagementClient(this.azureAccount.getCredentialByTenantId(subscription.tenantId), subscription.subscriptionId);

        const resourceGroupsTask = util.listAll(resourceClient.resourceGroups, resourceClient.resourceGroups.list());
        const plansTask = util.listAll(webSiteClient.appServicePlans, webSiteClient.appServicePlans.list());

        var groups: ResourceModels.ResourceGroup[];
        let plans: WebSiteModels.AppServicePlan[];

        var results = await Promise.all([resourceGroupsTask, plansTask]);
        groups = results[0];
        plans = results[1];

        const nameTaken = (name: string) => {
            if (groups.findIndex(rg => rg.name.toLowerCase() === name.toLowerCase()) >= 0) {
                return true;
            }
            if (plans.findIndex(hp => hp.name.toLowerCase() === name.toLowerCase()) >= 0) {
                return true;
            }

            return false;
        };

        if (!nameTaken(siteName)) {
            return siteName;
        }

        var i = 2;
        while (true) {
            // Website names are limited to 60 characters, resource group names to 90
            const maxNameLength = 60;

            var suffix = `-${i}`;
            var suffixedName = siteName.slice(0, maxNameLength - suffix.length) + suffix;
            if (!nameTaken(suffixedName)) {
                return suffixedName;
            }

            ++i;
        }
    }

    async execute(): Promise<void> {
    }

    get websiteName(): string {
        return this._websiteName;
    }

    get suggestedRGAndPlanName(): string {
        return this._suggestedRGAndPlanName;
    }
}

interface LinuxRuntimeStack {
    name: string;
    displayName: string;
}

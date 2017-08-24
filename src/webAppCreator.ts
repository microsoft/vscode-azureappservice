/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AzureAccountWrapper } from './azureAccountWrapper';
import { WizardBase, WizardResult, WizardStep, UserCancelledError } from './wizard';
import { SubscriptionModels, ResourceManagementClient, ResourceModels } from 'azure-arm-resource';
import WebSiteManagementClient = require('azure-arm-website');
import * as WebSiteModels from '../node_modules/azure-arm-website/lib/models';
import * as util from './util';

export class WebAppCreator extends WizardBase {
    constructor(readonly azureAccount: AzureAccountWrapper) {
        super();
        this.steps.push(new SubscriptionStep(this, azureAccount));
        this.steps.push(new ResourceGroupStep(this, azureAccount));
        this.steps.push(new AppServicePlanStep(this, azureAccount));
        this.steps.push(new AppServiceStep(this, azureAccount));
    }
}

class SubscriptionBasedWizardStep extends WizardStep {
    protected constructor(wizard: WizardBase, stepTitle: string, readonly azureAccount: AzureAccountWrapper) {
        super(wizard, stepTitle);
    }

    protected getSelectedSubscription(): SubscriptionModels.Subscription {
        const subscriptionStep = <SubscriptionStep>this.wizard.findStep(step => step instanceof SubscriptionStep, 'The Wizard must have a SubscriptionStep.');

        if (!subscriptionStep.selectedSubscription) {
            throw new Error('A subscription must be selected before selecting a resource group.');
        }

        return subscriptionStep.selectedSubscription;
    }
}

class SubscriptionStep extends WizardStep {
    private _selectedSubscription: SubscriptionModels.Subscription;

    constructor(wizard: WizardBase, readonly azureAccount: AzureAccountWrapper) {
        super(wizard, 'Select subscription');
    }

    async prompt(): Promise<void> {
        const inFilterSubscriptions = await this.azureAccount.getFilteredSubscriptions();
        const otherSubscriptions = await this.azureAccount.getAllSubscriptions();
        const quickPickItems = new Array<vscode.QuickPickItem>();
        const quickPickOptions = { placeHolder: `Select the subscription where the new Web App will be created in... (${this.stepProgressText})` };

        inFilterSubscriptions.forEach(s => {
            const index = otherSubscriptions.findIndex(other => other.subscriptionId === s.subscriptionId);
            if (index >= 0) {   // Remove duplicated items from "all subscriptions".
                otherSubscriptions.splice(index, 1);
            }

            const item = {
                label: `📌 ${s.displayName}`,
                description: '',
                detail: s.subscriptionId
            };

            quickPickItems.push(item);
        });

        otherSubscriptions.forEach(s => {
            const item = {
                label: s.displayName,
                description: '',
                detail: s.subscriptionId
            };

            quickPickItems.push(item);
        });

        const result = await this.showQuickPick(quickPickItems, quickPickOptions);
        this._selectedSubscription = inFilterSubscriptions.concat(otherSubscriptions).find(s => s.subscriptionId === result.detail);
    }

    get selectedSubscription(): SubscriptionModels.Subscription {
        return this._selectedSubscription;
    }
}

class ResourceGroupStep extends SubscriptionBasedWizardStep {
    private _createNew: boolean;
    private _rgName: string;
    private _rgLocation: string;

    constructor(wizard: WizardBase, azureAccount: AzureAccountWrapper) {
        super(wizard, 'Select or create resource group', azureAccount);
    }

    async prompt(): Promise<void> {
        const createNewItem: vscode.QuickPickItem = {
            label: '➕ New Resource Group',
            description: 'Creates a new resource group',
            detail: ''
        };
        const quickPickItems = [createNewItem];
        const quickPickOptions = { placeHolder: `Select the resource group where the new Web App will be created in... (${this.stepProgressText})` };
        const subscription = this.getSelectedSubscription();
        const resourceClient = new ResourceManagementClient(this.azureAccount.getCredentialByTenantId(subscription.tenantId), subscription.subscriptionId);
        const resourceGroups = await util.listAll(resourceClient.resourceGroups, resourceClient.resourceGroups.list());
        const locations = await this.azureAccount.getLocationsBySubscription(this.getSelectedSubscription());

        resourceGroups.forEach(rg => {
            quickPickItems.push({
                label: rg.name,
                description: `(${locations.find(l => l.name.toLowerCase() === rg.location.toLowerCase()).displayName})`,
                detail: ''
            });
        });

        const result = await this.showQuickPick(quickPickItems, quickPickOptions);

        if (result !== createNewItem) {
            const rg = resourceGroups.find(rg => rg.name.localeCompare(result.label) === 0);
            this._createNew = false;
            this._rgName = rg.name;
            this._rgLocation = rg.location;
            return;
        }

        const newRgName = await this.showInputBox({
            prompt: 'Enter the name of the new resource group',
            validateInput: (value: string) => {
                value = value.trim();

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
        const locationPickItems = locations.map<vscode.QuickPickItem>(location => {
            return {
                label: location.displayName,
                description: `(${location.name})`,
                detail: ''
            };
        });
        const locationPickOptions = { placeHolder: 'Select the location of the new resource group...' };
        const pickedLocation = await this.showQuickPick(locationPickItems, locationPickOptions);

        this._createNew = true;
        this._rgName = newRgName;
        this._rgLocation = locations.find(l => l.displayName.localeCompare(pickedLocation.label) === 0).name;
    }

    get resourceGroupName(): string {
        return this._rgName;
    }

    get resourceGroupLocation(): string {
        return this._rgLocation;
    }

    get createNewResourceGroup(): boolean {
        return this._createNew;
    }
}

class AppServicePlanStep extends SubscriptionBasedWizardStep {
    private _selectedPlan: WebSiteModels.AppServicePlan;

    constructor(wizard: WizardBase, azureAccount: AzureAccountWrapper) {
        super(wizard, 'Select or create App Service Plan', azureAccount);
    }

    async prompt(): Promise<void> {
        const createNewItem: vscode.QuickPickItem = {
            label: '➕ New App Service Plan',
            description: 'Creates a new App Service Plan',
            detail: ''
        };
        const quickPickItems = [createNewItem];
        const quickPickOptions = { placeHolder: `Select the App Service Plan for the new Web App... (${this.stepProgressText})` };
        const subscription = this.getSelectedSubscription();
        const client = new WebSiteManagementClient(this.azureAccount.getCredentialByTenantId(subscription.tenantId), subscription.subscriptionId);
        // You can create a web app and associate it with a plan from another resource group.
        // That's why we use list instead of listByResourceGroup below; and show resource group name in the quick pick list.
        const plans = await util.listAll(client.appServicePlans, client.appServicePlans.list());

        plans.forEach(plan => {
            // Currently we only do Linux web apps.
            if (plan.kind.toLowerCase() === 'linux') {
                quickPickItems.push({
                    label: plan.appServicePlanName,
                    description: `${plan.sku.name} (${plan.geoRegion})`,
                    detail: plan.resourceGroup
                });
            }
        });
        
        const pickedItem = await this.showQuickPick(quickPickItems, quickPickOptions);

        if (pickedItem !== createNewItem) {
            plans.find(plan => {
                

                return true;
            });
        }
    }

    get selectedPlan(): WebSiteModels.AppServicePlan {
        return this._selectedPlan;
    }
}

class AppServiceStep extends SubscriptionBasedWizardStep {
    constructor(wizard: WizardBase, azureAccount: AzureAccountWrapper) {
        super(wizard, 'appService', azureAccount);
    }
}

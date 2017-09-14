/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AzureAccountWrapper } from './azureAccountWrapper';
import { WizardBase, WizardResult, WizardStep, SubscriptionStepBase, QuickPickItemWithData, UserCancelledError } from './wizard';
import { SubscriptionModels, ResourceManagementClient, ResourceModels } from 'azure-arm-resource';
import WebSiteManagementClient = require('azure-arm-website');
import * as WebSiteModels from '../node_modules/azure-arm-website/lib/models';
import * as util from './util';

export class WebAppCreator extends WizardBase {
    constructor(output: vscode.OutputChannel, readonly azureAccount: AzureAccountWrapper, subscription?: SubscriptionModels.Subscription) {
        super(output);
        this.steps.push(new SubscriptionStep(this, azureAccount, subscription));
        this.steps.push(new ResourceGroupStep(this, azureAccount));
        this.steps.push(new AppServicePlanStep(this, azureAccount));
        this.steps.push(new WebsiteStep(this, azureAccount));
        this.steps.push(new ShellScriptStep(this, azureAccount));
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
        const websiteStep = this.steps.find(step => step instanceof WebsiteStep);
        return (<WebsiteStep>websiteStep).website;
    }

    protected beforeExecute(step: WizardStep, stepIndex: number) {
        if (stepIndex == 0) {
            this.writeline('Start creating new Web App...');
        }
    }

    protected onExecuteError(step: WizardStep, stepIndex: number, error: Error) {
        util.sendTelemetry('WebAppCreatorError', 
        {
            step: step ? step.stepTitle : 'Unknown',
            error: error ? JSON.stringify(error) : ''
        });

        if (error instanceof UserCancelledError) {
            return;
        }
        this.writeline(`Failed to create new Web App - ${error.message}`);
        this.writeline('');
    }
}

class WebAppCreatorStepBase extends WizardStep {
    protected constructor(wizard: WizardBase, stepTitle: string, readonly azureAccount: AzureAccountWrapper) {
        super(wizard, stepTitle);
    }

    protected getSelectedSubscription(): SubscriptionModels.Subscription {
        const subscriptionStep = <SubscriptionStep>this.wizard.findStep(step => step instanceof SubscriptionStep, 'The Wizard must have a SubscriptionStep.');

        if (!subscriptionStep.subscription) {
            throw new Error('A subscription must be selected first.');
        }

        return subscriptionStep.subscription;
    }

    protected getSelectedResourceGroup(): ResourceModels.ResourceGroup {
        const resourceGroupStep = <ResourceGroupStep>this.wizard.findStep(step => step instanceof ResourceGroupStep, 'The Wizard must have a ResourceGroupStep.');

        if (!resourceGroupStep.resourceGroup) {
            throw new Error('A resource group must be selected first.');
        }

        return resourceGroupStep.resourceGroup;
    }

    protected getSelectedAppServicePlan(): WebSiteModels.AppServicePlan {
        const appServicePlanStep = <AppServicePlanStep>this.wizard.findStep(step => step instanceof AppServicePlanStep, 'The Wizard must have a AppServicePlanStep.');
        
        if (!appServicePlanStep.servicePlan) {
            throw new Error('An App Service Plan must be selected first.');
        }

        return appServicePlanStep.servicePlan;
    }

    protected getWebSite(): WebSiteModels.Site {
        const websiteStep = <WebsiteStep>this.wizard.findStep(step => step instanceof WebsiteStep, 'The Wizard must have a WebsiteStep.');
        
        if (!websiteStep.website) {
            throw new Error('A website must be created first.');
        }

        return websiteStep.website;
    }
}

class SubscriptionStep extends SubscriptionStepBase {
    constructor(wizard: WizardBase, azureAccount: AzureAccountWrapper, subscrption?: SubscriptionModels.Subscription) {
        super(wizard, 'Select subscription', azureAccount);
        this._subscription = subscrption;
    }

    async prompt(): Promise<void> {
        if (!!this.subscription) {
            return;
        }

        const quickPickItems = this.getSubscriptionsAsQuickPickItems();
        const quickPickOptions = { placeHolder: `Select the subscription where the new Web App will be created in. (${this.stepProgressText})` };
        const result = await this.showQuickPick(quickPickItems, quickPickOptions);
        this._subscription = result.data;
    }

    async execute(): Promise<void> {
        this.wizard.writeline(`The new Web App will be created in subscription "${this.subscription.displayName}" (${this.subscription.subscriptionId}).`);
    }
}

class ResourceGroupStep extends WebAppCreatorStepBase {
    private _createNew: boolean;
    private _rg: ResourceModels.ResourceGroup;

    constructor(wizard: WizardBase, azureAccount: AzureAccountWrapper) {
        super(wizard, 'Select or create resource group', azureAccount);
    }

    async prompt(): Promise<void> {
        const createNewItem: QuickPickItemWithData<ResourceModels.ResourceGroup> = {
            label: '$(plus) Create New Resource Group',
            description: '',
            data: null
        };
        const quickPickOptions = { placeHolder: `Select the resource group where the new Web App will be created in. (${this.stepProgressText})` };
        const subscription = this.getSelectedSubscription();
        const resourceClient = new ResourceManagementClient(this.azureAccount.getCredentialByTenantId(subscription.tenantId), subscription.subscriptionId);
        var resourceGroups: ResourceModels.ResourceGroup[];
        var locations: SubscriptionModels.Location[];
        const resourceGroupsTask = util.listAll(resourceClient.resourceGroups, resourceClient.resourceGroups.list());
        const locationsTask = this.azureAccount.getLocationsBySubscription(this.getSelectedSubscription());
        const quickPickItemsTask = Promise.all([resourceGroupsTask, locationsTask]).then(results => {
            const quickPickItems = [createNewItem];
            resourceGroups = results[0];
            locations = results[1];
            resourceGroups.forEach(rg => {
                quickPickItems.push({
                    label: rg.name,
                    description: `(${locations.find(l => l.name.toLowerCase() === rg.location.toLowerCase()).displayName})`,
                    detail: '',
                    data: rg
                });
            });

            return quickPickItems;
        });

        const result = await this.showQuickPick(quickPickItemsTask, quickPickOptions);

        if (result !== createNewItem) {
            const rg = result.data;
            this._createNew = false;
            this._rg = rg;
            return;
        }

        const newRgName = await this.showInputBox({
            prompt: 'Enter the name of the new resource group.',
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
        const locationPickItems = locations.map<QuickPickItemWithData<SubscriptionModels.Location>>(location => {
            return {
                label: location.displayName,
                description: `(${location.name})`,
                detail: '',
                data: location
            };
        });
        const locationPickOptions = { placeHolder: 'Select the location of the new resource group.' };
        const pickedLocation = await this.showQuickPick(locationPickItems, locationPickOptions);

        this._createNew = true;
        this._rg = {
            name: newRgName,
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

    constructor(wizard: WizardBase, azureAccount: AzureAccountWrapper) {
        super(wizard, 'Select or create App Service Plan', azureAccount);
    }

    async prompt(): Promise<void> {
        const createNewItem: QuickPickItemWithData<WebSiteModels.AppServicePlan> = {
            label: '$(plus) Create New App Service Plan',
            description: '',
            data: null
        };
        const quickPickOptions = { placeHolder: `Select the App Service Plan for the new Web App. (${this.stepProgressText})` };
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
                        label: plan.appServicePlanName,
                        description: `${plan.sku.name} (${plan.geoRegion})`,
                        detail: plan.resourceGroup,
                        data: plan
                    });
                }
            });
    
            return quickPickItems;
        });

        
        const pickedItem = await this.showQuickPick(plansTask, quickPickOptions);

        if (pickedItem !== createNewItem) {
            this._createNew = false;
            this._plan = pickedItem.data;
            return;
        }

        // Prompt for new plan information.
        const rg = this.getSelectedResourceGroup();
        const newPlanName = await this.showInputBox({
            prompt: 'Enter the name of the new App Service Plan.',
            validateInput: (value: string) => {
                value = value.trim();

                if (plans.findIndex(plan => plan.resourceGroup.toLowerCase() === rg.name && value.localeCompare(plan.name) === 0) >= 0) {
                    return `App Service Plan name "${value}" already exists in resource group "${rg.name}".`;
                }

                if (!value.match(/^[a-z0-9\-]{0,39}$/ig)) {
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
                label: sku.name,
                description: sku.tier,
                detail: '',
                data: sku
            });
        });
        const pickedSkuItem = await this.showQuickPick(pricingTiers, { placeHolder: 'Choose your pricing tier.' });
        const newPlanSku = pickedSkuItem.data;
        this._createNew = true;
        this._plan = {
            appServicePlanName: newPlanName,
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

    constructor(wizard: WizardBase, azureAccount: AzureAccountWrapper) {
        super(wizard, 'Create Web App', azureAccount);
    }

    async prompt(): Promise<void> {
        const subscription = this.getSelectedSubscription();
        const client = new WebSiteManagementClient(this.azureAccount.getCredentialByTenantId(subscription.tenantId), subscription.subscriptionId);
        const siteName = await this.showInputBox({
            prompt: `Enter the name of the new Web App. (${this.stepProgressText})`,
            validateInput: (value: string) => {
                value = value.trim();

                if (!value.match(/^[a-z0-9\-]{0,59}$/ig)) {
                    return 'App name should be 1-60 characters long and can only include alphanumeric characters and hyphens.';
                }

                return null;
            }
        });
        const runtimeItems: QuickPickItemWithData<LinuxRuntimeStack>[] = [];
        const linuxRuntimeStacks = this.getLinuxRuntimeStack();
        
        linuxRuntimeStacks.forEach(rt => {
            runtimeItems.push({
                label: rt.displayName,
                description: '',
                data: rt
            });
        });

        const pickedItem = await this.showQuickPick(runtimeItems, { placeHolder: 'Select runtime stack.' });
        const runtimeStack = pickedItem.data.name;
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
                displayName: 'Node.js 6.11'
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

class ShellScriptStep extends WebAppCreatorStepBase {
    constructor(wizard: WizardBase, azureAccount: AzureAccountWrapper) {
        super(wizard, 'Create Web App', azureAccount);
    }
    
    async execute(): Promise<void> {
        const subscription = this.getSelectedSubscription();
        const rg = this.getSelectedResourceGroup();
        const plan = this.getSelectedAppServicePlan();
        const site = this.getWebSite();
        
        const script = scriptTemplate.replace('%SUBSCRIPTION_NAME%', subscription.displayName)
            .replace('%RG_NAME%', rg.name)
            .replace('%LOCATION%', rg.location)
            .replace('%PLAN_NAME%', plan.name)
            .replace('%PLAN_SKU%', plan.sku.name)
            .replace('%SITE_NAME%', site.name)
            .replace('%RUNTIME%', site.siteConfig.linuxFxVersion);
        vscode.workspace.openTextDocument({
            content: script,
            language: 'shellscript'
        }).then(doc => vscode.window.showTextDocument(doc));
    }    
}

interface LinuxRuntimeStack {
    name: string;
    displayName: string;
}

const scriptTemplate = 'SUBSCRIPTION="%SUBSCRIPTION_NAME%"\n\
RESOURCEGROUP="%RG_NAME%"\n\
LOCATION="%LOCATION%"\n\
PLANNAME="%PLAN_NAME%"\n\
PLANSKU="%PLAN_SKU%"\n\
SITENAME="%SITE_NAME%"\n\
RUNTIME="%RUNTIME%"\n\
\n\
# login supports device login, username/password, and service principals\n\
# see https://docs.microsoft.com/en-us/cli/azure/?view=azure-cli-latest#az_login\n\
az login\n\
# list all of the available subscriptions\n\
az account list -o table\n\
# set the default subscription for subsequent operations\n\
az account set --subscription $SUBSCRIPTION\n\
# create a resource group for your application\n\
az group create --name $RESOURCEGROUP --location $LOCATION\n\
# create an appservice plan (a machine) where your site will run\n\
az appservice plan create --name $PLANNAME --location $LOCATION --is-linux --sku $PLANSKU --resource-group $RESOURCEGROUP\n\
# create the web application on the plan\n\
# specify the node version your app requires\n\
az webapp create --name $SITENAME --plan $PLANNAME --runtime $RUNTIME --resource-group $RESOURCEGROUP\n\
\n\
# To set up deployment from a local git repository, uncomment the following commands.\n\
# first, set the username and password (use environment variables!)\n\
# USERNAME=""\n\
# PASSWORD=""\n\
# az webapp deployment user set --user-name $USERNAME --password $PASSWORD\n\
\n\
# now, configure the site for deployment. in this case, we will deploy from the local git repository\n\
# you can also configure your site to be deployed from a remote git repository or set up a CI/CD workflow\n\
# az webapp deployment source config-local-git --name $SITENAME --resource-group $RESOURCEGROUP\n\
\n\
# the previous command returned the git remote to deploy to\n\
# use this to set up a new remote named "azure"\n\
# git remote add azure "https://$USERNAME@$SITENAME.scm.azurewebsites.net/cdias-appname-site.git"\n\
# push master to deploy the site\n\
# git push azure master\n\
\n\
# browse to the site\n\
# az webapp browse --name $SITENAME --resource-group $RESOURCEGROUP\n\
';

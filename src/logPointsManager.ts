import * as vscode from 'vscode';
import * as util from './util';
import { UserCancelledError } from './errors';
import { AzureAccountWrapper } from './azureAccountWrapper';
import { SubscriptionModels } from 'azure-arm-resource';
import * as WebSiteModels from '../node_modules/azure-arm-website/lib/models';
import { WizardBase, WizardStep, QuickPickItemWithData } from './wizard';

import WebSiteManagementClient = require('azure-arm-website');

export class LogPointsSessionAttach extends WizardBase {
    readonly hasSlot: boolean;
    selectedDeploymentSlot: WebSiteModels.Site

    constructor(output: vscode.OutputChannel,
        readonly azureAccount: AzureAccountWrapper,
        readonly site: WebSiteModels.Site,
        readonly subscription?: SubscriptionModels.Subscription
    ) {
        super(output);
        if (util.isSiteDeploymentSlot(this.site)) {
            this.selectedDeploymentSlot = this.site;
        } else {
            this.steps.push(new PromptSlotSelection(this, azureAccount, subscription, this.site));
        }

        this.steps.push(new PickProcessStep(this));
        this.steps.push(new SessionAttachStep(this));
    }

    protected beforeExecute() { }

    protected onExecuteError(error: Error) {
        if (error instanceof UserCancelledError) {
            return;
        }
        this.writeline(`Deployment failed - ${error.message}`);
        this.writeline('');
    }
}

class PromptSlotSelection extends WizardStep {
    constructor(wizard: LogPointsSessionAttach, readonly azureAccount: AzureAccountWrapper, readonly subscription: SubscriptionModels.Subscription, readonly site: WebSiteModels.Site) {
        super(wizard, 'Choose a deployment slot.');
    }

    async execute(): Promise<void> {
        let deploymentSlots: WebSiteModels.WebAppCollection;

        // Decide if this AppService uses deployment slots
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            p.report({ message: 'Enumerating deployment slots for the App Service...' });
            deploymentSlots = await this.getDeploymentSlots();
        })

        // if there is only one slot, just use that one and don't prompt for user selection.
        if (deploymentSlots.length == 1) {
            (<LogPointsSessionAttach>this.wizard).selectedDeploymentSlot = deploymentSlots[0];
            return;
        }

        const deploymentQuickPickItems = deploymentSlots.map((deploymentSlot: WebSiteModels.Site) => {
            return <QuickPickItemWithData<WebSiteModels.Site>>{
                label: util.extractDeploymentSlotName(deploymentSlot) || deploymentSlot.name,
                description: '',
                data: deploymentSlot
            }
        });

        const quickPickOption = { placeHolder: `Please select a deployment slot: (${this.stepProgressText})` };
        const pickedItem = await this.showQuickPick(deploymentQuickPickItems, quickPickOption);

        (<LogPointsSessionAttach>this.wizard).selectedDeploymentSlot = pickedItem.data;
    }

    private getDeploymentSlots(): Promise<WebSiteModels.WebAppCollection> {
        const credential = this.azureAccount.getCredentialByTenantId(this.subscription.tenantId);
        const client = new WebSiteManagementClient(credential, this.subscription.subscriptionId);
        return client.webApps.listByResourceGroup(this.site.resourceGroup, { includeSlots: true });
    }
}

class PickProcessStep extends WizardStep {
    constructor(wizard: WizardBase) {
        super(wizard, 'Start.');
    }

    async execute(): Promise<void> {
        vscode.window.showInformationMessage("The deployment slot you selected is: " + (<LogPointsSessionAttach>this.wizard).selectedDeploymentSlot.name);
        // TODO: Call Agent API to start a session and then retrieve the processes list
    }
}

class SessionAttachStep extends WizardStep {
    constructor(wizard: WizardBase) {
        super(wizard, 'Start.');
    }

    async execute(): Promise<void> {
        // TODO: Call Agent API to open debugging port
    }
}

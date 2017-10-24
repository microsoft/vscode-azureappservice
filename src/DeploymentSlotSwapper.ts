/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SubscriptionModels } from 'azure-arm-resource';

// tslint:disable-next-line:no-require-imports
import WebSiteManagementClient = require('azure-arm-website');
import * as vscode from 'vscode';
import { AzureAccountWrapper } from './AzureAccountWrapper';
import { UserCancelledError } from './errors';
import { DeploymentSlotNode } from './explorer/DeploymentSlotNode';
import { DeploymentSlotsNode } from './explorer/DeploymentSlotsNode';
import { IQuickPickItemWithData, WizardBase, WizardStep } from './wizard';

export class DeploymentSlotSwapper extends WizardBase {
    private readonly azureAccount: AzureAccountWrapper;
    private readonly slot: DeploymentSlotNode;

    constructor(output: vscode.OutputChannel, azureAccount: AzureAccountWrapper, slot: DeploymentSlotNode) {
        super(output);
        this.azureAccount = azureAccount;
        this.slot = slot;
    }

    protected initSteps(): void {
        this.steps.push(new SwapStep(this, this.azureAccount, this.slot));
    }

    protected beforeExecute(): void { }
}

class SwapStep extends WizardStep {
    private readonly azureAccount: AzureAccountWrapper;
    private _subscription: SubscriptionModels.Subscription;
    private _sourceSlot: DeploymentSlotNode;
    private _targetSlot: DeploymentSlotNode;

    get sourceSlot(): DeploymentSlotNode {
        return this._sourceSlot;
    }
    set sourceSlot(slot: DeploymentSlotNode) {
        this._sourceSlot = slot;
    }
    get targetSlot(): DeploymentSlotNode {
        return this._targetSlot;
    }
    set targetSlot(slot: DeploymentSlotNode) {
        this._targetSlot = slot;
    }

    constructor(wizard: WizardBase, azureAccount: AzureAccountWrapper, slot: DeploymentSlotNode) {
        super(wizard, 'Select a slot to swap with');
        this.azureAccount = azureAccount;
        this.sourceSlot = slot;
    }

    public async prompt(): Promise<void> {
        const deploymentSlots: DeploymentSlotNode[] = await this.sourceSlot.getParentNode<DeploymentSlotsNode>().getChildren();
        const otherSlots: IQuickPickItemWithData<DeploymentSlotNode | undefined>[] = [{
            label: 'production',
            description: 'Swap slot with production',
            detail: '',
            data: undefined
        }];

        for (const slot of deploymentSlots) {
            if (this.sourceSlot.label !== slot.label) {
                // Deployment slots must have an unique name
                const otherSlot: IQuickPickItemWithData<DeploymentSlotNode | undefined> = {
                    label: slot.label,
                    description: '',
                    data: slot
                };

                otherSlots.push(otherSlot);
            }
        }

        const quickPickOptions = { placeHolder: `"${this.sourceSlot.label}" will be swapped with the destination slot.` };
        const result = await this.showQuickPick(otherSlots, quickPickOptions);

        if (result) {
            this.targetSlot = result.data;
        } else {
            throw new UserCancelledError();
        }
    }

    public async execute(): Promise<void> {
        const credential = this.azureAccount.getCredentialByTenantId(this.sourceSlot.subscription.tenantId);
        const client = new WebSiteManagementClient(credential, this.sourceSlot.subscription.subscriptionId);
        // if this.targetSlot was assigned undefined, the user selected 'production'
        !this.targetSlot ?
            await client.webApps.swapSlotWithProduction(this.sourceSlot.site.resourceGroup, this.sourceSlot.site.repositorySiteName, { targetSlot: this.sourceSlot.label, preserveVnet: true }) :
            await client.webApps.swapSlotSlot(this.sourceSlot.site.resourceGroup, this.sourceSlot.site.repositorySiteName, { targetSlot: this.targetSlot.label, preserveVnet: true }, this.sourceSlot.label);

        this.wizard.writeline(`"${this.targetSlot.label}" was swapped with "${this.sourceSlot.label}".`);
    }

    get subscription(): SubscriptionModels.Subscription {
        return this._subscription;
    }
}

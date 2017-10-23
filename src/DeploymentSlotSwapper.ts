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
    constructor(output: vscode.OutputChannel, readonly azureAccount: AzureAccountWrapper, readonly slot: DeploymentSlotNode) {
        super(output);
    }

    protected initSteps(): void {
        this.steps.push(new SwapStep(this, this.azureAccount, this.slot));
    }

    protected beforeExecute(): void { }
}

class SwapStep extends WizardStep {
    private _subscription: SubscriptionModels.Subscription;
    private _sourceSlot;
    private _targetSlot;

    get sourceSlot(): DeploymentSlotNode {
        return this._sourceSlot;
    }
    get targetSlot(): string {
        return this._targetSlot;
    }
    set sourceSlot(slot: DeploymentSlotNode) {
        this._sourceSlot = slot;
    }
    set targetSlot(slot: string) {
        this._targetSlot = slot;
    }

    constructor(wizard: WizardBase, readonly azureAccount: AzureAccountWrapper, readonly slot: DeploymentSlotNode) {
        super(wizard, 'Select a slot to swap with');
        this.sourceSlot = slot;
    }

    public async prompt(): Promise<void> {
        const deploymentSlots: DeploymentSlotNode[] = await this.slot.getParentNode<DeploymentSlotsNode>().getChildren();
        const otherSlots: IQuickPickItemWithData<null>[] = [{
            label: 'production',
            description: 'Swap slot with production',
            detail: null,
            data: null
        }];

        for (const slot of deploymentSlots) {
            if (this.slot.label !== slot.label) {
                // Deployment slots must have an unique name
                const otherSlot: IQuickPickItemWithData<null> = {
                    label: slot.label,
                    description: '',
                    data: null
                };

                otherSlots.push(otherSlot);
            }
        }

        const quickPickOptions = { placeHolder: `"${this.sourceSlot.label}" will be swapped with the destination slot.` };
        const result = await this.showQuickPick(otherSlots, quickPickOptions);

        if (result) {
            this.targetSlot = result.label;
        } else {
            throw new UserCancelledError;
        }
    }

    public async execute(): Promise<void> {
        const credential = this.azureAccount.getCredentialByTenantId(this.slot.subscription.tenantId);
        const client = new WebSiteManagementClient(credential, this.slot.subscription.subscriptionId);
        this.targetSlot === 'production' ?
            await client.webApps.swapSlotWithProduction(this.slot.site.resourceGroup, this.slot.site.repositorySiteName, { targetSlot: this.sourceSlot.label, preserveVnet: true }) :
            await client.webApps.swapSlotSlot(this.slot.site.resourceGroup, this.slot.site.repositorySiteName, { targetSlot: this.targetSlot, preserveVnet: true }, this.sourceSlot.label);

        this.wizard.writeline(`"${this.targetSlot}" was swapped with "${this.sourceSlot.label}".`);
    }

    get subscription(): SubscriptionModels.Subscription {
        return this._subscription;
    }
}

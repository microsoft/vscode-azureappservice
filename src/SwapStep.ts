/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SubscriptionModels } from 'azure-arm-resource';
// tslint:disable-next-line:no-require-imports
import WebSiteManagementClient = require('azure-arm-website');
import { IAzureNode, UserCancelledError } from 'vscode-azureextensionui';
import { DeploymentSlotTreeItem } from './explorer/DeploymentSlotTreeItem';
import { IQuickPickItemWithData } from './util';
import { nodeUtils } from './utils/nodeUtils';
import { WizardBase, WizardStep } from './wizard';

export class SwapStep extends WizardStep {
    private _subscription: SubscriptionModels.Subscription;
    private _sourceSlotNode: IAzureNode<DeploymentSlotTreeItem>;
    private targetSlot: DeploymentSlotTreeItem | undefined;

    private readonly _productionSlotLabel: string = 'production';

    get sourceSlot(): DeploymentSlotTreeItem {
        return this._sourceSlotNode.treeItem;
    }

    constructor(wizard: WizardBase, slot: IAzureNode<DeploymentSlotTreeItem>) {
        super(wizard, 'Select a slot to swap with');
        this._sourceSlotNode = slot;
    }

    public async prompt(): Promise<void> {
        const deploymentSlots: IAzureNode<DeploymentSlotTreeItem>[] = <IAzureNode<DeploymentSlotTreeItem>[]>await this._sourceSlotNode.parent.getCachedChildren();
        const otherSlots: IQuickPickItemWithData<DeploymentSlotTreeItem | undefined>[] = [{
            label: this._productionSlotLabel,
            description: 'Swap slot with production',
            detail: '',
            data: undefined
        }];

        for (const slot of deploymentSlots) {
            if (this.sourceSlot.siteWrapper.slotName !== slot.treeItem.siteWrapper.slotName) {
                // Deployment slots must have an unique name
                const otherSlot: IQuickPickItemWithData<DeploymentSlotTreeItem | undefined> = {
                    label: slot.treeItem.siteWrapper.slotName,
                    description: '',
                    data: slot.treeItem
                };

                otherSlots.push(otherSlot);
            }
        }

        const quickPickOptions = { placeHolder: `"${this.sourceSlot.siteWrapper.slotName}" will be swapped with the destination slot.`, ignoreFocusOut: true };
        const result = await this.showQuickPick(otherSlots, quickPickOptions);

        if (result) {
            this.targetSlot = result.data;
        } else {
            throw new UserCancelledError();
        }
    }

    public async execute(): Promise<void> {
        const client: WebSiteManagementClient = nodeUtils.getWebSiteClient(this._sourceSlotNode);
        // if this.targetSlot was assigned undefined, the user selected 'production'
        if (!this.targetSlot) {
            await client.webApps.swapSlotWithProduction(this.sourceSlot.site.resourceGroup, this.sourceSlot.site.repositorySiteName, { targetSlot: this.sourceSlot.siteWrapper.slotName, preserveVnet: true });
        } else {
            await client.webApps.swapSlotSlot(this.sourceSlot.site.resourceGroup, this.sourceSlot.site.repositorySiteName, { targetSlot: this.targetSlot.siteWrapper.slotName, preserveVnet: true }, this.sourceSlot.siteWrapper.slotName);
        }
        const targetSlotLabel: string = this.targetSlot ? this.targetSlot.siteWrapper.slotName : this._productionSlotLabel;
        this.wizard.writeline(`"${targetSlotLabel}" was swapped with "${this.sourceSlot.siteWrapper.slotName}".`);
    }

    get subscription(): SubscriptionModels.Subscription {
        return this._subscription;
    }
}

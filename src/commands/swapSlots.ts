/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient } from 'azure-arm-website';
import { ProgressLocation, window } from 'vscode';
import { SiteClient } from 'vscode-azureappservice';
import { createAzureClient, IAzureQuickPickItem } from 'vscode-azureextensionui';
import { DeploymentSlotTreeItem } from '../explorer/DeploymentSlotTreeItem';
import { ext } from '../extensionVariables';

export async function swapSlots(sourceSlotNode: DeploymentSlotTreeItem | undefined): Promise<void> {
    if (!sourceSlotNode) {
        sourceSlotNode = <DeploymentSlotTreeItem>await ext.tree.showTreeItemPicker(DeploymentSlotTreeItem.contextValue);
    }
    const sourceSlotClient: SiteClient = sourceSlotNode.root.client;

    const productionSlotLabel: string = 'production';
    // tslint:disable-next-line:no-non-null-assertion
    const deploymentSlots: DeploymentSlotTreeItem[] = <DeploymentSlotTreeItem[]>await sourceSlotNode.parent!.getCachedChildren();
    const otherSlots: IAzureQuickPickItem<DeploymentSlotTreeItem | undefined>[] = [{
        label: productionSlotLabel,
        description: 'Swap slot with production',
        detail: '',
        data: undefined
    }];

    for (const slot of deploymentSlots) {
        if (sourceSlotClient.slotName !== slot.root.client.slotName) {
            // Deployment slots must have an unique name
            const otherSlot: IAzureQuickPickItem<DeploymentSlotTreeItem | undefined> = {
                // tslint:disable-next-line:no-non-null-assertion
                label: slot.root.client.slotName!,
                description: '',
                data: slot
            };

            otherSlots.push(otherSlot);
        }
    }

    const quickPickOptions = { placeHolder: `Select which slot to swap with "${sourceSlotClient.slotName}".` };
    const targetSlot: DeploymentSlotTreeItem | undefined = (await ext.ui.showQuickPick(otherSlots, quickPickOptions)).data;

    // tslint:disable-next-line:no-non-null-assertion
    const targetSlotLabel: string = targetSlot ? targetSlot.root.client.fullName! : `${sourceSlotClient.siteName}-${productionSlotLabel}`;
    const swappingSlots: string = `Swapping "${targetSlotLabel}" with "${sourceSlotClient.fullName}"...`;
    const successfullySwapped: string = `Successfully swapped "${targetSlotLabel}" with "${sourceSlotClient.fullName}".`;
    ext.outputChannel.appendLine(swappingSlots);
    const client: WebSiteManagementClient = createAzureClient(sourceSlotNode.root, WebSiteManagementClient);
    await window.withProgress({ location: ProgressLocation.Notification, title: swappingSlots }, async () => {
        // if targetSlot was assigned undefined, the user selected 'production'
        if (!targetSlot) {
            // tslint:disable-next-line:no-non-null-assertion
            await client.webApps.swapSlotWithProduction(sourceSlotClient.resourceGroup, sourceSlotClient.siteName, { targetSlot: sourceSlotClient.slotName!, preserveVnet: true });
        } else {
            // tslint:disable-next-line:no-non-null-assertion
            await client.webApps.swapSlotSlot(sourceSlotClient.resourceGroup, sourceSlotClient.siteName, { targetSlot: targetSlot.root.client.slotName!, preserveVnet: true }, sourceSlotClient.slotName!);
        }
        window.showInformationMessage(successfullySwapped);
        ext.outputChannel.appendLine(successfullySwapped);
    });

}

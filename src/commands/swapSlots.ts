/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import WebSiteManagementClient = require('azure-arm-website');
import { OutputChannel } from 'vscode';
import { SiteClient } from 'vscode-azureappservice';
import { AzureTreeDataProvider, IAzureNode, IAzureQuickPickItem } from 'vscode-azureextensionui';
import { DeploymentSlotTreeItem } from '../explorer/DeploymentSlotTreeItem';
import { nodeUtils } from '../utils/nodeUtils';

export async function swapSlots(tree: AzureTreeDataProvider, sourceSlotNode: IAzureNode<DeploymentSlotTreeItem> | undefined, outputChannel: OutputChannel): Promise<void> {
    if (!sourceSlotNode) {
        sourceSlotNode = <IAzureNode<DeploymentSlotTreeItem>>await tree.showNodePicker(DeploymentSlotTreeItem.contextValue);
    }
    const sourceSlotClient: SiteClient = sourceSlotNode.treeItem.client;

    const productionSlotLabel: string = 'production';
    const deploymentSlots: IAzureNode<DeploymentSlotTreeItem>[] = <IAzureNode<DeploymentSlotTreeItem>[]>await sourceSlotNode.parent.getCachedChildren();
    const otherSlots: IAzureQuickPickItem<DeploymentSlotTreeItem | undefined>[] = [{
        label: productionSlotLabel,
        description: 'Swap slot with production',
        detail: '',
        data: undefined
    }];

    for (const slot of deploymentSlots) {
        if (sourceSlotClient.slotName !== slot.treeItem.client.slotName) {
            // Deployment slots must have an unique name
            const otherSlot: IAzureQuickPickItem<DeploymentSlotTreeItem | undefined> = {
                label: slot.treeItem.client.slotName,
                description: '',
                data: slot.treeItem
            };

            otherSlots.push(otherSlot);
        }
    }

    const quickPickOptions = { placeHolder: `Select which slot to swap with "${sourceSlotClient.slotName}".` };
    const targetSlot: DeploymentSlotTreeItem | undefined = (await sourceSlotNode.ui.showQuickPick(otherSlots, quickPickOptions)).data;

    const targetSlotLabel: string = targetSlot ? targetSlot.client.slotName : productionSlotLabel;
    outputChannel.show(true);
    outputChannel.appendLine(`Swapping "${targetSlotLabel}" with "${sourceSlotClient.slotName}"...`);
    const client: WebSiteManagementClient = nodeUtils.getWebSiteClient(sourceSlotNode);
    // if targetSlot was assigned undefined, the user selected 'production'
    if (!targetSlot) {
        await client.webApps.swapSlotWithProduction(sourceSlotClient.resourceGroup, sourceSlotClient.siteName, { targetSlot: sourceSlotClient.slotName, preserveVnet: true });
    } else {
        await client.webApps.swapSlotSlot(sourceSlotClient.resourceGroup, sourceSlotClient.siteName, { targetSlot: targetSlot.client.slotName, preserveVnet: true }, sourceSlotClient.slotName);
    }
    outputChannel.appendLine(`Successfully swapped "${targetSlotLabel}" with "${sourceSlotClient.slotName}".`);
}

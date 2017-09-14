/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WebSiteModels from '../../node_modules/azure-arm-website/lib/models';
import * as opn from 'opn';
import { NodeBase } from './nodeBase';
import { SubscriptionClient, SubscriptionModels } from 'azure-arm-resource';
import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter, Event, OutputChannel } from 'vscode';
import { DeploymentSlotsNode } from './deploymentSlotsNodes';
import { DeploymentSlotSwapper } from '../deploymentSlotActions';
import { AzureAccountWrapper } from '../azureAccountWrapper';

export class DeploymentSlotNode extends NodeBase {
    constructor(readonly label: string, readonly site: WebSiteModels.Site, readonly subscription: SubscriptionModels.Subscription, readonly parent: DeploymentSlotsNode) {
        super(label);
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.None,
            contextValue: 'deploymentSlot',
        }
    }

    browse(): void {
        const defaultHostName = this.site.defaultHostName;
        const isSsl = this.site.hostNameSslStates.findIndex((value, index, arr) => 
            value.name === defaultHostName && value.sslState === "Enabled");
        const uri = `${isSsl ? 'https://' : 'http://'}${defaultHostName}`;
        opn(uri);
    }

    openInPortal(azureAccount: AzureAccountWrapper): void {
        const portalEndpoint = 'https://portal.azure.com';
        const deepLink = `${portalEndpoint}/${this.subscription.tenantId}/#resource${this.site.id}`;
        console.log(deepLink);
        opn(deepLink);
    }

    async swapDeploymentSlots(output: OutputChannel, azureAccount: AzureAccountWrapper): Promise<void> {
        const wizard = new DeploymentSlotSwapper(output, azureAccount, this);
        const result = await wizard.run();
    }
}
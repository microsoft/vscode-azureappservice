/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WebSiteModels from '../../node_modules/azure-arm-website/lib/models';
import * as opn from 'opn';
import * as path from 'path';
import { NodeBase } from './nodeBase';
import { SubscriptionClient, SubscriptionModels } from 'azure-arm-resource';
import WebSiteManagementClient = require('azure-arm-website');
import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter, Event, OutputChannel } from 'vscode';
import { DeploymentSlotNode } from './deploymentSlotNodes';
import { AzureAccountWrapper } from '../azureAccountWrapper';


export class DeploymentSlotsNode extends NodeBase {
    constructor(readonly site: WebSiteModels.Site, readonly subscription: SubscriptionModels.Subscription) {
        super('Deployment Slots');
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
            contextValue: "deploymentSlots",
            iconPath: { 
                light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'AzureDeploymentSlots_16x_vscode.svg'),
                dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'AzureDeploymentSlots_16x_vscode.svg')
            }
        }
    }

    async getChildren(azureAccount: AzureAccountWrapper): Promise<DeploymentSlotNode[]> {
        let nodes = [];
        const credential = azureAccount.getCredentialByTenantId(this.subscription.tenantId);
        const client = new WebSiteManagementClient(credential, this.subscription.subscriptionId);
        const deploymentSlots = await client.webApps.listByResourceGroup(this.site.resourceGroup, {includeSlots: true});
        
        for (let slot of deploymentSlots) {
            if (slot.type === 'Microsoft.Web/sites/slots') {
                nodes.push(new DeploymentSlotNode(slot.name.substring(slot.name.lastIndexOf('/') + 1), slot, this.subscription, this));
                // to pluck off the entire web app domain name from the deployment slot name
            }
        }
        return nodes;
    }
}
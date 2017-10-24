/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WebSiteModels from '../../node_modules/azure-arm-website/lib/models';
import * as opn from 'opn';
import * as path from 'path';
import * as util from '../util';
import { NodeBase } from './NodeBase';
import { AppServiceDataProvider } from './appServiceExplorer';
import { SubscriptionModels } from 'azure-arm-resource';
import WebSiteManagementClient = require('azure-arm-website');
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { DeploymentSlotNode } from './DeploymentSlotNode';
import { AzureAccountWrapper } from '../AzureAccountWrapper';



export class DeploymentSlotsNode extends NodeBase {
    constructor(readonly site: WebSiteModels.Site,
        readonly subscription: SubscriptionModels.Subscription,
        treeDataProvider: AppServiceDataProvider,
        parentNode: NodeBase) {
        super('Deployment Slots', treeDataProvider, parentNode);
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

    async getChildren(): Promise<DeploymentSlotNode[]> {
        let nodes: DeploymentSlotNode[] = [];
        const credential = this.azureAccount.getCredentialByTenantId(this.subscription.tenantId);
        const client = new WebSiteManagementClient(credential, this.subscription.subscriptionId);
        const deploymentSlots = await client.webApps.listByResourceGroup(this.site.resourceGroup, { includeSlots: true });
        for (let slot of deploymentSlots) {
            if (util.isSiteDeploymentSlot(slot) && slot.repositorySiteName === this.site.name) {
                nodes.push(new DeploymentSlotNode(util.extractDeploymentSlotName(slot),
                    slot, this.subscription, this.getTreeDataProvider(), this));
            }
        }
        return nodes;
    }

    openInPortal(): void {
        const portalEndpoint = 'https://portal.azure.com';
        const deepLink = `${portalEndpoint}/${this.subscription.tenantId}/#resource${this.site.id}/deploymentSlots`;
        opn(deepLink);
    }

    private get azureAccount(): AzureAccountWrapper {
        return this.getTreeDataProvider<AppServiceDataProvider>().azureAccount;
    }
}

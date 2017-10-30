/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SubscriptionModels } from 'azure-arm-resource';
import WebSiteManagementClient = require('azure-arm-website');
import * as opn from 'opn';
import * as path from 'path';
import { TreeItem, TreeItemCollapsibleState, window } from 'vscode';
import * as WebSiteModels from '../../node_modules/azure-arm-website/lib/models';
import { AzureAccountWrapper } from '../AzureAccountWrapper';
import { UserCancelledError } from '../errors';
import * as util from '../util';
import { AppServiceDataProvider } from './AppServiceExplorer';
import { DeploymentSlotNode } from './DeploymentSlotNode';
import { NodeBase } from './NodeBase';

export class DeploymentSlotsNode extends NodeBase {
    private readonly site: WebSiteModels.Site;
    private readonly subscription: SubscriptionModels.Subscription;
    constructor(
        site: WebSiteModels.Site,
        subscription: SubscriptionModels.Subscription,
        treeDataProvider: AppServiceDataProvider,
        parentNode: NodeBase) {
        super('Deployment Slots', treeDataProvider, parentNode);
        this.site = site;
        this.subscription = subscription;
    }

    public getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
            contextValue: 'deploymentSlots',
            iconPath: {
                light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'DeploymentSlots_color.svg'),
                dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'DeploymentSlots_color.svg')
            }
        };
    }

    public async getChildren(): Promise<DeploymentSlotNode[]> {
        const nodes: DeploymentSlotNode[] = [];
        const credential = this.azureAccount.getCredentialByTenantId(this.subscription.tenantId);
        const client = new WebSiteManagementClient(credential, this.subscription.subscriptionId);
        const deploymentSlots = await client.webApps.listByResourceGroup(this.site.resourceGroup, { includeSlots: true });
        for (const slot of deploymentSlots) {
            if (util.isSiteDeploymentSlot(slot) && slot.repositorySiteName === this.site.name) {
                nodes.push(new DeploymentSlotNode(
                    util.extractDeploymentSlotName(slot),
                    slot, this.subscription, this.getTreeDataProvider(), this));
            }
        }
        return nodes;
    }

    public openInPortal(): void {
        const portalEndpoint = 'https://portal.azure.com';
        const deepLink = `${portalEndpoint}/${this.subscription.tenantId}/#resource${this.site.id}/deploymentSlots`;
        opn(deepLink);
    }

    private get azureAccount(): AzureAccountWrapper {
        return this.getTreeDataProvider<AppServiceDataProvider>().azureAccount;
    }

    public async createNewDeploymentSlot(): Promise<string> {
        let slotName;
        const slotNodes = await this.getChildren();
        const slotLabels = slotNodes.map(node => {
            return node.label;
        });

        slotName = await this.promptForSlotName(slotLabels);
        if (!slotName) {
            throw new UserCancelledError();
        }
        slotName = slotName.trim();
        const newDeploymentSlot = {
            name: slotName,
            kind: this.site.kind,
            location: this.site.location,
            serverFarmId: this.site.serverFarmId
        };
        // if user has more slots than the service plan allows, Azure will respond with an error
        await this.webSiteClient.webApps.createOrUpdateSlot(this.site.resourceGroup, util.extractSiteName(this.site), newDeploymentSlot, slotName);
        return slotName;
    }

    protected get webSiteClient(): WebSiteManagementClient {
        return new WebSiteManagementClient(this.azureAccount.getCredentialByTenantId(this.subscription.tenantId), this.subscription.subscriptionId);
    }

    protected async promptForSlotName(slotLabels: string[]): Promise<string | undefined> {
        return await window.showInputBox({
            prompt: 'Enter a unique name for the new deployment slot',
            validateInput: (value: string) => {
                value = value ? value.trim() : '';
                if (!value.match(/^[a-z0-9\-]{1,60}$/ig)) {
                    return 'Name should be 1-60 characters long and can only include alphanumeric characters and hyphens.';
                }

                // Can not have identical slot names OR production
                if (value === 'production' || slotLabels.indexOf(value) !== -1) {
                    return `The slot name "${value}" is not available`;
                }

                return null;
            }
        });
    }
}

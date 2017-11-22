/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Site, WebAppCollection } from 'azure-arm-website/lib/models';
import * as path from 'path';
import { window } from 'vscode';
import { IAzureNode, IAzureParentNode, IAzureParentTreeItem, IAzureTreeItem, UserCancelledError } from 'vscode-azureextensionui';
import * as util from '../util';
import { nodeUtils } from '../utils/nodeUtils';
import { DeploymentSlotTreeItem } from './DeploymentSlotTreeItem';

export class DeploymentSlotsTreeItem implements IAzureParentTreeItem {
    public static contextValue: string = 'deploymentSlots';
    public readonly contextValue: string = DeploymentSlotsTreeItem.contextValue;
    public readonly label: string = 'Deployment Slots';
    public readonly childTypeLabel: string = 'Deployment Slot';
    public readonly site: Site;

    private _nextLink: string | undefined;

    constructor(site: Site) {
        this.site = site;
    }

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'DeploymentSlots_color.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'DeploymentSlots_color.svg')
        };
    }

    public get id(): string {
        return `${this.site.id}/deploymentSlots`;
    }

    public hasMoreChildren(): boolean {
        return this._nextLink !== undefined;
    }

    public async loadMoreChildren(node: IAzureNode): Promise<IAzureTreeItem[]> {
        const deploymentSlotsNode: DeploymentSlotsTreeItem = <DeploymentSlotsTreeItem>node.treeItem;

        const webAppCollection: WebAppCollection = this._nextLink === undefined ?
            await nodeUtils.getWebSiteClient(node).webApps.listByResourceGroup(deploymentSlotsNode.site.resourceGroup, { includeSlots: true }) :
            await nodeUtils.getWebSiteClient(node).webApps.listByResourceGroupNext(this._nextLink);

        this._nextLink = webAppCollection.nextLink;

        return webAppCollection
            .filter((s: Site) => util.isSiteDeploymentSlot(s) && s.repositorySiteName === deploymentSlotsNode.site.name)
            .map((s: Site) => new DeploymentSlotTreeItem(s));
    }

    public async createChild(node: IAzureParentNode<DeploymentSlotsTreeItem>, showCreatingNode: (label: string) => void): Promise<IAzureTreeItem> {
        const slotNodes: IAzureNode<DeploymentSlotTreeItem>[] = <IAzureNode<DeploymentSlotTreeItem>[]>await node.getCachedChildren();
        const slotLabels: string[] = slotNodes.map((n: IAzureNode<DeploymentSlotTreeItem>) => n.treeItem.siteWrapper.slotName);
        let slotName: string = await this.promptForSlotName(slotLabels);
        if (!slotName) {
            throw new UserCancelledError();
        }
        slotName = slotName.trim();
        const newDeploymentSlot = {
            name: slotName,
            kind: node.treeItem.site.kind,
            location: node.treeItem.site.location,
            serverFarmId: node.treeItem.site.serverFarmId
        };

        showCreatingNode(slotName);

        // if user has more slots than the service plan allows, Azure will respond with an error
        const newSite: Site = await nodeUtils.getWebSiteClient(node).webApps.createOrUpdateSlot(node.treeItem.site.resourceGroup, util.extractSiteName(node.treeItem.site), newDeploymentSlot, slotName);
        return new DeploymentSlotTreeItem(newSite);
    }

    private async promptForSlotName(slotLabels: string[]): Promise<string | undefined> {
        return await window.showInputBox({
            prompt: 'Enter a unique name for the new deployment slot',
            ignoreFocusOut: true,
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

export class DeploymentSlotsNATreeItem implements IAzureParentTreeItem {
    public static contextValue: string = "deploymentNASlots";
    public readonly label: string = 'Deployment Slots (N/A for Basic Service Plan)';
    public readonly contextValue: string = DeploymentSlotsNATreeItem.contextValue;
    public readonly id: string = DeploymentSlotsNATreeItem.contextValue;

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'DeploymentSlots_grayscale.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'DeploymentSlots_grayscale.svg')
        };
    }

    public hasMoreChildren(): boolean {
        return false;
    }

    public async loadMoreChildren(_node: IAzureNode): Promise<IAzureTreeItem[]> {
        const id: string = 'NASlotWarning';
        return [{ id: id, contextValue: id, label: "Make sure you're running with a Standard or Premium plan before adding a slot" }];
    }
}

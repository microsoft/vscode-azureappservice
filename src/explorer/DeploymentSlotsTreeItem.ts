/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NameValuePairs, Site, WebAppCollection } from 'azure-arm-website/lib/models';
import * as path from 'path';
import { window } from 'vscode';
import { IAzureNode, IAzureParentNode, IAzureParentTreeItem, IAzureTreeItem, UserCancelledError } from 'vscode-azureextensionui';
import * as util from '../util';
import { nodeUtils } from '../utils/nodeUtils';
import { DeploymentSlotTreeItem } from './DeploymentSlotTreeItem';
import { ResourceNameAvailability } from 'azure-arm-website/lib/models';

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
        let slotName: string = await this.promptForSlotName(node);
        if (!slotName) {
            throw new UserCancelledError();
        }

        const configurationSource = this.chooseConfigurationSource(node);
        console.log(configurationSource);

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

    private async promptForSlotName(node: IAzureParentNode<DeploymentSlotsTreeItem>): Promise<string | undefined> {
        const slotName = await window.showInputBox({
            prompt: 'Enter a unique name for the new deployment slot',
            ignoreFocusOut: true,
            validateInput: async (value: string) => {
                value = value ? value.trim() : '';
                // Can not have "production" as a slot name, but checkNameAvailability doesn't validate that
                if (value === 'production') {
                    return `The slot name "${value}" is not available.`;
                }

                const nameAvailability: ResourceNameAvailability = await nodeUtils.getWebSiteClient(node).checkNameAvailability(`${util.extractSiteName(node.treeItem.site)}-${value}`, 'Slot');
                if (!nameAvailability.nameAvailable) {
                    return nameAvailability.message;
                }

                return null;
            }
        });
    }

    private async chooseConfigurationSource(node: IAzureParentNode<DeploymentSlotsTreeItem>): Promise<IAzureNode | undefined> {
        const deploymentSlots: IAzureNode[] = <IAzureNode[]>await node.getCachedChildren();
        const configurationSources: util.IQuickPickItemWithData<IAzureNode | undefined>[] = [{
            label: "Don't clone configuration from an existing slot",
            description: '',
            data: undefined
        }];
        // add the production slot itself
        configurationSources.push({
            label: node.parent.treeItem._siteName,
            description: '',
            detail: '',
            data: node.parent
        });

        // add the web app's current deployment slots
        for (const slot of deploymentSlots) {
            configurationSources.push({
                label: `${slot.treeItem._siteName}-${slot.treeItem._slotName}`,
                description: '',
                data: slot
            });
        }

        const quickPickOptions = { placeHolder: `Choose a configuration source.` };
        const result = await window.showQuickPick(configurationSources, quickPickOptions);
        return result.data;
    }

    // const config = await client.webApps.getConfiguration(node.treeItem.site.resourceGroup, util.extractSiteName(node.treeItem.site));
    //     const appSettings = await client.webApps.listApplicationSettings(node.treeItem.site.resourceGroup, util.extractSiteName(node.treeItem.site));
    //     const keyValuePairs: NameValuePair[] = [];
    //     for (const key of Object.keys(appSettings.properties)) {
    //         keyValuePairs.push({ name: key, value: appSettings.properties[key] });

    //     }
    //     config.appSettings = keyValuePairs;
    //     slotName = slotName.trim();
    //     const newDeploymentSlot = {
    //         name: slotName,
    //         kind: node.treeItem.site.kind,
    //         location: node.treeItem.site.location,
    //         serverFarmId: node.treeItem.site.serverFarmId,
    //         siteConfig: config
    //     };
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

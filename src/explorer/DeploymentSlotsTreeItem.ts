/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient } from 'azure-arm-website';
import { Site, WebAppCollection } from 'azure-arm-website/lib/models';
import * as path from 'path';
import { createSlot, ISiteTreeRoot, SiteClient } from 'vscode-azureappservice';
import { AzureParentTreeItem, AzureTreeItem, createAzureClient } from 'vscode-azureextensionui';
import { resourcesPath } from '../constants';
import { DeploymentSlotTreeItem } from './DeploymentSlotTreeItem';

export class DeploymentSlotsTreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'deploymentSlots';
    public readonly contextValue: string = DeploymentSlotsTreeItem.contextValue;
    public readonly label: string = 'Deployment Slots';
    public readonly childTypeLabel: string = 'Deployment Slot';

    private _nextLink: string | undefined;

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(resourcesPath, 'light', 'DeploymentSlots_color.svg'),
            dark: path.join(resourcesPath, 'dark', 'DeploymentSlots_color.svg')
        };
    }

    public get id(): string {
        return `${this.root.client.id}/slots`;
    }

    public hasMoreChildrenImpl(): boolean {
        return this._nextLink !== undefined;
    }

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<AzureTreeItem<ISiteTreeRoot>[]> {
        if (clearCache) {
            this._nextLink = undefined;
        }

        const client: WebSiteManagementClient = createAzureClient(this.root, WebSiteManagementClient);
        const webAppCollection: WebAppCollection = this._nextLink === undefined ?
            await client.webApps.listSlots(this.root.client.resourceGroup, this.root.client.siteName) :
            await client.webApps.listSlotsNext(this._nextLink);

        this._nextLink = webAppCollection.nextLink;

        return webAppCollection.map((s: Site) => new DeploymentSlotTreeItem(this, new SiteClient(s, this.root)));
    }

    public async createChildImpl(showCreatingTreeItem: (label: string) => void): Promise<AzureTreeItem<ISiteTreeRoot>> {
        const existingSlots: DeploymentSlotTreeItem[] = <DeploymentSlotTreeItem[]>await this.getCachedChildren();
        const newSite: Site = await createSlot(this.root, existingSlots, showCreatingTreeItem);
        return new DeploymentSlotTreeItem(this, new SiteClient(newSite, this.root));
    }
}

export class ScaleUpTreeItem extends AzureTreeItem<ISiteTreeRoot> {
    public readonly label: string = "Scale up to a production plan to enable slots...";
    public readonly contextValue: string = "ScaleUp";
    public readonly commandId: string = 'appService.ScaleUp';

    public readonly scaleUpId: string;

    public constructor(parent: AzureParentTreeItem, scaleUpId: string) {
        super(parent);
        this.scaleUpId = scaleUpId;
    }
}

export class DeploymentSlotsNATreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public static contextValue: string = "deploymentNASlots";
    public readonly label: string;
    public readonly contextValue: string = DeploymentSlotsNATreeItem.contextValue;
    public readonly id: string = DeploymentSlotsNATreeItem.contextValue;

    public readonly scaleUpId: string;

    public constructor(parent: AzureParentTreeItem, planId: string) {
        super(parent);
        this.label = 'Deployment Slots';
        this.scaleUpId = `${planId}/pricingTier`;
    }

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(resourcesPath, 'light', 'DeploymentSlots_grayscale.svg'),
            dark: path.join(resourcesPath, 'dark', 'DeploymentSlots_grayscale.svg')
        };
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzureTreeItem<ISiteTreeRoot>[]> {
        return [new ScaleUpTreeItem(this, this.scaleUpId)];
    }
}

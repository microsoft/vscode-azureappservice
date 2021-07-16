/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient, WebSiteManagementModels } from '@azure/arm-appservice';
import { createSlot, ISiteTreeRoot, SiteClient } from 'vscode-azureappservice';
import { AzureParentTreeItem, AzureTreeItem, ICreateChildImplContext, TreeItemIconPath } from 'vscode-azureextensionui';
import { getCreatedWebAppMessage } from '../commands/createWebApp/showCreatedWebAppMessage';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { createWebSiteClient } from '../utils/azureClients';
import { getThemedIconPath } from '../utils/pathUtils';
import { DeploymentSlotTreeItem } from './DeploymentSlotTreeItem';
import { NotAvailableTreeItem } from './NotAvailableTreeItem';

const label: string = localize('deploymentSlots', 'Deployment Slots');
export class DeploymentSlotsTreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'deploymentSlots';
    public readonly contextValue: string = DeploymentSlotsTreeItem.contextValue;
    public readonly label: string = label;
    public readonly childTypeLabel: string = 'Deployment Slot';
    public suppressMaskLabel = true;

    private _nextLink: string | undefined;

    public get iconPath(): TreeItemIconPath {
        return getThemedIconPath('DeploymentSlots_color');
    }

    public get id(): string {
        return `${this.root.client.id}/slots`;
    }

    public hasMoreChildrenImpl(): boolean {
        return !!this._nextLink;
    }

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<AzureTreeItem<ISiteTreeRoot>[]> {
        if (clearCache) {
            this._nextLink = undefined;
        }

        const client: WebSiteManagementClient = await createWebSiteClient(this.root);
        const webAppCollection: WebSiteManagementModels.WebAppCollection = this._nextLink ?
            await client.webApps.listSlotsNext(this._nextLink) :
            await client.webApps.listSlots(this.root.client.resourceGroup, this.root.client.siteName);

        this._nextLink = webAppCollection.nextLink;

        return webAppCollection.map(s => new DeploymentSlotTreeItem(this, new SiteClient(s, this.root), s));
    }

    public async createChildImpl(context: ICreateChildImplContext): Promise<AzureTreeItem<ISiteTreeRoot>> {
        const existingSlots: DeploymentSlotTreeItem[] = <DeploymentSlotTreeItem[]>await this.getCachedChildren(context);
        const newSite: WebSiteManagementModels.Site = await createSlot(this.root, existingSlots, context);
        const siteClient: SiteClient = new SiteClient(newSite, this.root);
        ext.outputChannel.appendLog(getCreatedWebAppMessage(siteClient));
        return new DeploymentSlotTreeItem(this, siteClient, newSite);
    }
}

export class ScaleUpTreeItem extends AzureTreeItem<ISiteTreeRoot> {
    public static contextValue: string = "ScaleUp";
    public readonly label: string = localize('scaleUp', "Scale up to a production plan to enable slots...");
    public readonly contextValue: string = ScaleUpTreeItem.contextValue;
    public readonly scaleUpId: string;

    public constructor(parent: AzureParentTreeItem, scaleUpId: string) {
        super(parent);
        this.scaleUpId = scaleUpId;
        this.commandId = 'appService.ScaleUp';
    }
}

export class DeploymentSlotsNATreeItem extends NotAvailableTreeItem {
    public static contextValue: string = "deploymentNASlots";
    public readonly label: string;
    public readonly contextValue: string = DeploymentSlotsNATreeItem.contextValue;
    public readonly childTypeLabel: string = localize('scaleUpToEnable', 'scale up to enable slots');
    public suppressMaskLabel = true;

    public readonly scaleUpId: string;

    public constructor(parent: AzureParentTreeItem, planId: string) {
        super(parent);
        this.label = label;
        this.id = DeploymentSlotsNATreeItem.contextValue;
        this.scaleUpId = `${planId}/pricingTier`;
    }

    public get iconPath(): TreeItemIconPath {
        return getThemedIconPath('DeploymentSlots_grayscale');
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzureTreeItem<ISiteTreeRoot>[]> {
        return [new ScaleUpTreeItem(this, this.scaleUpId)];
    }
}

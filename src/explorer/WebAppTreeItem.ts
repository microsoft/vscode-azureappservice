/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from '@azure/arm-appservice';
import { SiteClient } from 'vscode-azureappservice';
import { AzExtTreeItem } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { nonNullProp, nonNullValue } from '../utils/nonNull';
import { DeploymentSlotsNATreeItem, DeploymentSlotsTreeItem } from './DeploymentSlotsTreeItem';
import { DeploymentSlotTreeItem } from './DeploymentSlotTreeItem';
import { SiteTreeItem } from './SiteTreeItem';

export class WebAppTreeItem extends SiteTreeItem {
    public static contextValue: string = ext.prefix;
    public readonly contextValue: string = WebAppTreeItem.contextValue;
    public deploymentSlotsNode: DeploymentSlotsTreeItem | DeploymentSlotsNATreeItem;

    public get client(): SiteClient {
        return this.root.client;
    }

    public get label(): string {
        return this.root.client.siteName;
    }

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<AzExtTreeItem[]> {
        let tier: string | undefined;
        let asp: WebSiteManagementModels.AppServicePlan | undefined;
        try {
            asp = await this.root.client.getAppServicePlan();
            tier = asp && asp.sku && asp.sku.tier;
        } catch (err) {
            // ignore this error, we don't want to block users for deployment slots
            tier = 'unknown';
        }

        this.deploymentSlotsNode = tier && /^(basic|free|shared)$/i.test(tier) ? new DeploymentSlotsNATreeItem(this, nonNullProp(nonNullValue(asp), 'id')) : new DeploymentSlotsTreeItem(this);
        return (await super.loadMoreChildrenImpl(clearCache)).concat(this.deploymentSlotsNode);
    }

    public pickTreeItemImpl(expectedContextValues: (string | RegExp)[]): AzExtTreeItem | undefined {
        for (const expectedContextValue of expectedContextValues) {
            switch (expectedContextValue) {
                case DeploymentSlotsTreeItem.contextValue:
                case DeploymentSlotTreeItem.contextValue:
                    return this.deploymentSlotsNode;
                default:
            }
        }

        return super.pickTreeItemImpl(expectedContextValues);
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from '@azure/arm-appservice';
import { SiteClient } from 'vscode-azureappservice';
import { TreeItemIconPath } from 'vscode-azureextensionui';
import { nonNullProp } from '../utils/nonNull';
import { getThemedIconPath } from '../utils/pathUtils';
import { DeploymentSlotsTreeItem } from './DeploymentSlotsTreeItem';
import { SiteTreeItem } from './SiteTreeItem';

export class DeploymentSlotTreeItem extends SiteTreeItem {
    public static contextValue: string = 'deploymentSlot';
    public readonly contextValue: string = DeploymentSlotTreeItem.contextValue;
    public readonly parent!: DeploymentSlotsTreeItem;

    public constructor(parent: DeploymentSlotsTreeItem, client: SiteClient, site: WebSiteManagementModels.Site) {
        super(parent, client, site);
    }

    public get label(): string {
        return nonNullProp(this.root.client, 'slotName');
    }

    public get iconPath(): TreeItemIconPath {
        return getThemedIconPath('DeploymentSlot_color');
    }
}

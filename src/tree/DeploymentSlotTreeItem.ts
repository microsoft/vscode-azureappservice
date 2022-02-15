/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ParsedSite } from '@microsoft/vscode-azext-azureappservice';
import { TreeItemIconPath } from '@microsoft/vscode-azext-utils';
import { nonNullProp } from '../utils/nonNull';
import { getThemedIconPath } from '../utils/pathUtils';
import { DeploymentSlotsTreeItem } from './DeploymentSlotsTreeItem';
import { SiteTreeItem } from './SiteTreeItem';

export class DeploymentSlotTreeItem extends SiteTreeItem {
    public static contextValue: string = 'deploymentSlot';
    public readonly contextValue: string = DeploymentSlotTreeItem.contextValue;
    public readonly parent!: DeploymentSlotsTreeItem;

    public constructor(parent: DeploymentSlotsTreeItem, site: ParsedSite) {
        super(parent, site);
    }

    public get label(): string {
        return nonNullProp(this.site, 'slotName');
    }

    public get iconPath(): TreeItemIconPath {
        return getThemedIconPath('DeploymentSlot_color');
    }
}

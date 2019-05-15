/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteClient } from 'vscode-azureappservice';
import { nonNullProp } from '../utils/nonNull';
import { getThemedIconPath, IThemedIconPath } from '../utils/pathUtils';
import { DeploymentSlotsTreeItem, ScaleUpTreeItem } from './DeploymentSlotsTreeItem';
import { SiteTreeItem } from './SiteTreeItem';

export class DeploymentSlotTreeItem extends SiteTreeItem {
    public static contextValue: string = 'deploymentSlot';
    public readonly contextValue: string = DeploymentSlotTreeItem.contextValue;
    public readonly parent: DeploymentSlotsTreeItem;

    public constructor(parent: DeploymentSlotsTreeItem, client: SiteClient) {
        super(parent, client);
    }

    public get label(): string {
        return nonNullProp(this.root.client, 'slotName');
    }

    public get iconPath(): IThemedIconPath {
        return getThemedIconPath('DeploymentSlot_color');
    }

    public isAncestorOfImpl(): boolean {
        if (this.parent.contextValue === ScaleUpTreeItem.contextValue) {
            return false;
        }

        return true;
    }
}

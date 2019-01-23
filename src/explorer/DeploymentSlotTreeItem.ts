/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { SiteClient } from 'vscode-azureappservice';
import { resourcesPath } from '../constants';
import { DeploymentSlotsTreeItem } from './DeploymentSlotsTreeItem';
import { SiteTreeItem } from './SiteTreeItem';

export class DeploymentSlotTreeItem extends SiteTreeItem {
    public static contextValue: string = 'deploymentSlot';
    public readonly contextValue: string = DeploymentSlotTreeItem.contextValue;
    public readonly parent: DeploymentSlotsTreeItem;

    public constructor(parent: DeploymentSlotsTreeItem, client: SiteClient) {
        super(parent, client);
    }

    public get label(): string {
        // tslint:disable-next-line:no-non-null-assertion
        return this.root.client.slotName!;
    }

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(resourcesPath, 'light', 'DeploymentSlot_color.svg'),
            dark: path.join(resourcesPath, 'dark', 'DeploymentSlot_color.svg')
        };
    }
}

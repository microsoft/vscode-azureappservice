/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WebSiteModels from 'azure-arm-website/lib/models';
import * as path from 'path';
import { AppSettingsTreeItem } from 'vscode-azureappservice';
import { IAzureParentNode, IAzureTreeItem } from 'vscode-azureextensionui';
import { SiteTreeItem } from './SiteTreeItem';

export class DeploymentSlotTreeItem extends SiteTreeItem {
    public static contextValue: string = 'deploymentSlot';
    public readonly contextValue: string = DeploymentSlotTreeItem.contextValue;

    constructor(site: WebSiteModels.Site) {
        super(site);
    }

    public get label(): string {
        const state = this.site.state;
        return `${this.siteWrapper.slotName} ${state && state.toLowerCase() !== 'running' ? '(' + state + ')' : ''}`;
    }

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'DeploymentSlot_color.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'DeploymentSlot_color.svg')
        };
    }

    public async loadMoreChildren(node: IAzureParentNode<DeploymentSlotTreeItem>): Promise<IAzureTreeItem[]> {
        return [new AppSettingsTreeItem(node.treeItem.siteWrapper)];
    }
}

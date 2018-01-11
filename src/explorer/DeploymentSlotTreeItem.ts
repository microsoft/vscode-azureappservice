/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WebSiteModels from 'azure-arm-website/lib/models';
import * as path from 'path';
import { workspace } from 'vscode';
import { AppSettingsTreeItem } from 'vscode-azureappservice';
import { IAzureParentNode, IAzureTreeItem } from 'vscode-azureextensionui';
import { FolderTreeItem } from './FolderTreeItem';
import { SiteTreeItem } from './SiteTreeItem';

export class DeploymentSlotTreeItem extends SiteTreeItem {
    public static contextValue: string = 'deploymentSlot';
    public readonly contextValue: string = DeploymentSlotTreeItem.contextValue;
    private readonly appSettingsNode: IAzureTreeItem;
    private readonly folderNode: IAzureTreeItem;

    constructor(site: WebSiteModels.Site) {
        super(site);
        this.folderNode = new FolderTreeItem(this.siteWrapper, 'Files', "/site/wwwroot", true);
        this.appSettingsNode = new AppSettingsTreeItem(this.siteWrapper);
    }

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'DeploymentSlot_color.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'DeploymentSlot_color.svg')
        };
    }

    public async loadMoreChildren(_node: IAzureParentNode<DeploymentSlotTreeItem>): Promise<IAzureTreeItem[]> {
        return workspace.getConfiguration().get("appService.showRemoteFiles") ?
            [this.folderNode, this.appSettingsNode] :
            [this.appSettingsNode];
    }

    public pickTreeItem(expectedContextValue: string): IAzureTreeItem | undefined {
        switch (expectedContextValue) {
            case AppSettingsTreeItem.contextValue:
                return this.appSettingsNode;
            case FolderTreeItem.contextValue:
                return this.folderNode;
            default:
                return undefined;
        }
    }
}

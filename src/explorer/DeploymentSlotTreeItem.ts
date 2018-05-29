/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { AppSettingsTreeItem, SiteClient } from 'vscode-azureappservice';
import { IAzureParentNode, IAzureTreeItem } from 'vscode-azureextensionui';
import { FolderTreeItem } from './FolderTreeItem';
import { SiteTreeItem } from './SiteTreeItem';

export class DeploymentSlotTreeItem extends SiteTreeItem {
    public static contextValue: string = 'deploymentSlot';
    public readonly contextValue: string = DeploymentSlotTreeItem.contextValue;
    private readonly appSettingsNode: IAzureTreeItem;
    private readonly folderNode: IAzureTreeItem;

    constructor(client: SiteClient) {
        super(client);
        this.folderNode = new FolderTreeItem(this.client, 'Files', "/site/wwwroot", true);
        this.appSettingsNode = new AppSettingsTreeItem(this.client);
    }

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'DeploymentSlot_color.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'DeploymentSlot_color.svg')
        };
    }

    public async loadMoreChildren(_node: IAzureParentNode<DeploymentSlotTreeItem>): Promise<IAzureTreeItem[]> {
        return [this.folderNode, this.appSettingsNode];
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

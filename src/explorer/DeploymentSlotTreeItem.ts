/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteConfig } from 'azure-arm-website/lib/models';
import * as path from 'path';
import { AppSettingsTreeItem, DeploymentsTreeItem, ISiteTreeRoot, SiteClient } from 'vscode-azureappservice';
import { AzureParentTreeItem, AzureTreeItem } from 'vscode-azureextensionui';
import { FolderTreeItem } from './FolderTreeItem';
import { SiteTreeItem } from './SiteTreeItem';

export class DeploymentSlotTreeItem extends SiteTreeItem {

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'DeploymentSlot_color.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'DeploymentSlot_color.svg')
        };
    }
    public static contextValue: string = 'deploymentSlot';
    public readonly contextValue: string = DeploymentSlotTreeItem.contextValue;
    public deploymentsNode: DeploymentsTreeItem | undefined;
    private readonly appSettingsNode: AppSettingsTreeItem;
    private readonly folderNode: FolderTreeItem;
    private readonly logFolderNode: FolderTreeItem;

    constructor(parent: AzureParentTreeItem, client: SiteClient) {
        super(parent, client);
        this.folderNode = new FolderTreeItem(this, 'Files', "/site/wwwroot");
        this.logFolderNode = new FolderTreeItem(this, 'Logs', '/LogFiles', 'logFolder');
        this.appSettingsNode = new AppSettingsTreeItem(this);

    }

    public async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzureParentTreeItem<ISiteTreeRoot>[]> {
        const siteConfig: SiteConfig = await this.root.client.getSiteConfig();
        this.deploymentsNode = new DeploymentsTreeItem(this, siteConfig);
        return [this.folderNode, this.logFolderNode, this.appSettingsNode, this.deploymentsNode];
    }

    public pickTreeItemImpl(expectedContextValue: string): AzureTreeItem<ISiteTreeRoot> | undefined {
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

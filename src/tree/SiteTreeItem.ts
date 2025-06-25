/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type Site } from '@azure/arm-appservice';
import { type DeploymentsTreeItem, type ParsedSite } from '@microsoft/vscode-azext-azureappservice';
import { type AppSettingsTreeItem } from '@microsoft/vscode-azext-azureappsettings';
import { AzExtParentTreeItem, type AzExtTreeDataProvider, type AzExtTreeItem, type IActionContext, type TreeItemIconPath } from '@microsoft/vscode-azext-utils';
import { ext } from '../extensionVariables';
import { type ISiteTreeItem } from './ISiteTreeItem';
import { ResolvedWebAppResource } from './ResolvedWebAppResource';

export class SiteTreeItem extends AzExtParentTreeItem implements ISiteTreeItem {
    public contextValue: string = 'azAppSlot';
    public resolved: ResolvedWebAppResource;

    public appSettingsNode!: AppSettingsTreeItem;
    public deploymentsNode: DeploymentsTreeItem | undefined;

    public treeDataProvider: AzExtTreeDataProvider;
    public constructor(parent: AzExtParentTreeItem, site: Site) {
        super(parent);
        this.treeDataProvider = parent.treeDataProvider ?? ext.rgApi.appResourceTree;
        this.resolved = new ResolvedWebAppResource(parent.subscription, site);
    }

    public get label(): string {
        return this.resolved.label;
    }

    public get logStreamLabel(): string {
        return this.resolved.logStreamLabel;
    }

    public get id(): string {
        return this.resolved.id;
    }

    public get description(): string | undefined {
        return this.resolved.description;
    }

    public get iconPath(): TreeItemIconPath {
        return this.resolved.iconPath;
    }

    public get defaultHostUrl(): string {
        return this.resolved.defaultHostUrl;
    }

    public get defaultHostName(): string {
        return this.resolved.defaultHostName;
    }

    public get site(): ParsedSite {
        return this.resolved.site;
    }

    public async initSite(context: IActionContext): Promise<void> {
        return await this.resolved.initSite(context);
    }

    public hasMoreChildrenImpl(): boolean {
        return this.resolved.hasMoreChildrenImpl();
    }

    public async refreshImpl(context: IActionContext): Promise<void> {
        return await this.resolved.refreshImpl(context);
    }

    public async loadMoreChildrenImpl(_clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]> {
        return await this.resolved.loadMoreChildrenImpl.call(this, _clearCache, context);
    }

    public pickTreeItemImpl(expectedContextValues: (string | RegExp)[]): AzExtTreeItem | undefined {
        return this.resolved.pickTreeItemImpl(expectedContextValues);
    }

    public compareChildrenImpl(ti1: AzExtTreeItem, ti2: AzExtTreeItem): number {
        return this.resolved.compareChildrenImpl(ti1, ti2);
    }

    public async deleteTreeItemImpl(context: IActionContext): Promise<void> {
        return await this.resolved.deleteTreeItemImpl(context);
    }

    public async browse(context: IActionContext): Promise<void> {
        return await this.resolved.browse(context);
    }

    public async isHttpLogsEnabled(context: IActionContext): Promise<boolean> {
        return await this.resolved.isHttpLogsEnabled(context);
    }

    public async enableLogs(context: IActionContext): Promise<void> {
        return this.resolved.enableLogs(context);
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppSettingsTreeItem, DeploymentsTreeItem, ParsedSite } from '@microsoft/vscode-azext-azureappservice';
import { AzExtParentTreeItem, AzExtTreeItem, IActionContext, TreeItemIconPath } from '@microsoft/vscode-azext-utils';
import { ISiteTreeItem } from './ISiteTreeItem';
import { ResolvedWebAppResource } from './ResolvedWebAppResource';

export class SiteTreeItem extends AzExtParentTreeItem implements ISiteTreeItem {
    public contextValue!: string;
    public resolved: ResolvedWebAppResource;

    public appSettingsNode!: AppSettingsTreeItem;
    public deploymentsNode: DeploymentsTreeItem | undefined;

    public constructor(parent: AzExtParentTreeItem, site: ParsedSite) {
        super(parent);
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

    public hasMoreChildrenImpl(): boolean {
        return this.resolved.hasMoreChildrenImpl();
    }

    public async refreshImpl(context: IActionContext): Promise<void> {
        return await this.resolved.refreshImpl(context);
    }

    public async loadMoreChildrenImpl(_clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]> {
        return await this.resolved.loadMoreChildrenImpl(_clearCache, context);
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

    public async browse(): Promise<void> {
        return await this.resolved.browse();
    }

    public async isHttpLogsEnabled(context: IActionContext): Promise<boolean> {
        return await this.resolved.isHttpLogsEnabled(context);
    }

    public async enableLogs(context: IActionContext): Promise<void> {
        return this.resolved.enableLogs(context);
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from '@azure/arm-appservice';
import { AppSettingsTreeItem, AppSettingTreeItem, deleteSite, DeploymentsTreeItem, DeploymentTreeItem, FolderTreeItem, LogFilesTreeItem, ParsedSite, SiteFilesTreeItem } from 'vscode-azureappservice';
import { AzExtParentTreeItem, AzExtTreeItem, IActionContext } from 'vscode-azureextensionui';
import { nonNullValue } from '../utils/nonNull';
import { openUrl } from '../utils/openUrl';
import { CosmosDBConnection } from './CosmosDBConnection';
import { CosmosDBTreeItem } from './CosmosDBTreeItem';
import { ISiteTreeItem } from './ISiteTreeItem';
import { NotAvailableTreeItem } from './NotAvailableTreeItem';
import { SiteTreeItemBase } from './SiteTreeItemBase';
import { WebJobsNATreeItem, WebJobsTreeItem } from './WebJobsTreeItem';

export abstract class SiteTreeItem extends SiteTreeItemBase implements ISiteTreeItem {
    public readonly appSettingsNode: AppSettingsTreeItem;
    public deploymentsNode: DeploymentsTreeItem | undefined;
    public parent!: AzExtParentTreeItem;
    public site: ParsedSite;
    public connectionsNode: CosmosDBTreeItem;
    private readonly _siteFilesNode: SiteFilesTreeItem;
    private readonly _logFilesNode: LogFilesTreeItem;
    private readonly _webJobsNode: WebJobsTreeItem | WebJobsNATreeItem;

    constructor(parent: AzExtParentTreeItem, site: ParsedSite) {
        super(parent);
        this.site = site;

        this.appSettingsNode = new AppSettingsTreeItem(this, this.site);
        this.connectionsNode = new CosmosDBTreeItem(this, this.site);
        this._siteFilesNode = new SiteFilesTreeItem(this, this.site, false);
        this._logFilesNode = new LogFilesTreeItem(this, this.site);
        // Can't find actual documentation on this, but the portal claims it and this feedback suggests it's not planned https://aka.ms/AA4q5gi
        this._webJobsNode = this.site.isLinux ? new WebJobsNATreeItem(this) : new WebJobsTreeItem(this);

        const valuesToMask = [
            this.site.siteName, this.site.slotName, this.site.defaultHostName, this.site.resourceGroup,
            this.site.planName, this.site.planResourceGroup, this.site.kuduHostName, this.site.gitUrl,
            this.site.rawSite.repositorySiteName, ...(this.site.rawSite.hostNames || []), ...(this.site.rawSite.enabledHostNames || [])
        ];
        for (const v of valuesToMask) {
            if (v) {
                this.valuesToMask.push(v);
            }
        }
    }

    public get defaultHostUrl(): string {
        return this.site.defaultHostUrl;
    }

    public get defaultHostName(): string {
        return this.site.defaultHostName;
    }

    public async browse(): Promise<void> {
        await openUrl(this.site.defaultHostUrl);
    }

    public get description(): string | undefined {
        return this._state?.toLowerCase() !== 'running' ? this._state : undefined;
    }

    public get logStreamLabel(): string {
        return this.site.fullName;
    }

    public async refreshImpl(context: IActionContext): Promise<void> {
        const client = await this.site.createClient(context);
        this.site = new ParsedSite(nonNullValue(await client.getSite(), 'site'), this.subscription);
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public get id(): string {
        return this.site.id;
    }

    private get _state(): string | undefined {
        return this.site.rawSite.state;
    }

    public async loadMoreChildrenImpl(_clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]> {
        const client = await this.site.createClient(context);
        const siteConfig: WebSiteManagementModels.SiteConfig = await client.getSiteConfig();
        const sourceControl: WebSiteManagementModels.SiteSourceControl = await client.getSourceControl();
        this.deploymentsNode = new DeploymentsTreeItem(this, this.site, siteConfig, sourceControl);
        return [this.appSettingsNode, this.connectionsNode, this.deploymentsNode, this._siteFilesNode, this._logFilesNode, this._webJobsNode];
    }

    public compareChildrenImpl(ti1: AzExtTreeItem, ti2: AzExtTreeItem): number {
        if (ti1 instanceof NotAvailableTreeItem) {
            return 1;
        } else if (ti2 instanceof NotAvailableTreeItem) {
            return -1;
        } else {
            return ti1.label.localeCompare(ti2.label);
        }
    }

    public pickTreeItemImpl(expectedContextValues: (string | RegExp)[]): AzExtTreeItem | undefined {
        for (const expectedContextValue of expectedContextValues) {
            switch (expectedContextValue) {
                case AppSettingsTreeItem.contextValue:
                case AppSettingTreeItem.contextValue:
                    return this.appSettingsNode;
                case CosmosDBTreeItem.contextValueInstalled:
                case CosmosDBTreeItem.contextValueNotInstalled:
                case CosmosDBConnection.contextValue:
                    return this.connectionsNode;
                case DeploymentsTreeItem.contextValueConnected:
                case DeploymentsTreeItem.contextValueUnconnected:
                case DeploymentTreeItem.contextValue:
                    return this.deploymentsNode;
                case FolderTreeItem.contextValue:
                    return this._siteFilesNode;
                case WebJobsTreeItem.contextValue:
                    return this._webJobsNode;
                default:
                    if (typeof expectedContextValue === 'string' && DeploymentTreeItem.contextValue.test(expectedContextValue)) {
                        return this.deploymentsNode;
                    }
            }
        }

        return undefined;
    }

    public async deleteTreeItemImpl(context: IActionContext): Promise<void> {
        await deleteSite(context, this.site);
    }

    public async isHttpLogsEnabled(context: IActionContext): Promise<boolean> {
        const client = await this.site.createClient(context);
        const logsConfig: WebSiteManagementModels.SiteLogsConfig = await client.getLogsConfig();
        return !!(logsConfig.httpLogs && logsConfig.httpLogs.fileSystem && logsConfig.httpLogs.fileSystem.enabled);
    }

    public async enableLogs(context: IActionContext): Promise<void> {
        const logsConfig: WebSiteManagementModels.SiteLogsConfig = {};
        if (!this.site.isLinux) {
            logsConfig.applicationLogs = {
                fileSystem: {
                    level: 'Verbose'
                }
            };
        }
        logsConfig.httpLogs = {
            fileSystem: {
                enabled: true,
                retentionInDays: 7,
                retentionInMb: 100
            }
        };
        const client = await this.site.createClient(context);
        await client.updateLogsConfig(logsConfig);
    }
}

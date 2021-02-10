/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from '@azure/arm-appservice';
import { AppSettingsTreeItem, AppSettingTreeItem, deleteSite, DeploymentsTreeItem, DeploymentTreeItem, FolderTreeItem, ISiteTreeRoot, LogFilesTreeItem, SiteClient, SiteFilesTreeItem } from 'vscode-azureappservice';
import { AzExtTreeItem, AzureParentTreeItem, AzureTreeItem, openInPortal } from 'vscode-azureextensionui';
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
    public parent: AzureParentTreeItem;
    public site: WebSiteManagementModels.Site;
    private readonly _connectionsNode: CosmosDBTreeItem;
    private readonly _siteFilesNode: SiteFilesTreeItem;
    private readonly _logFilesNode: LogFilesTreeItem;
    private readonly _webJobsNode: WebJobsTreeItem | WebJobsNATreeItem;

    private readonly _root: ISiteTreeRoot;
    private _state?: string;

    constructor(parent: AzureParentTreeItem, client: SiteClient, site: WebSiteManagementModels.Site) {
        super(parent);
        this.site = site;
        this._root = Object.assign({}, parent.root, { client });
        this._state = client.initialState;

        this.appSettingsNode = new AppSettingsTreeItem(this, client);
        this._connectionsNode = new CosmosDBTreeItem(this, client);
        this._siteFilesNode = new SiteFilesTreeItem(this, client, false);
        this._logFilesNode = new LogFilesTreeItem(this, client);
        // Can't find actual documentation on this, but the portal claims it and this feedback suggests it's not planned https://aka.ms/AA4q5gi
        this._webJobsNode = this.root.client.isLinux ? new WebJobsNATreeItem(this) : new WebJobsTreeItem(this);
    }

    public get client(): SiteClient {
        return this.root.client;
    }

    public get defaultHostUrl(): string {
        return this.root.client.defaultHostUrl;
    }

    public get defaultHostName(): string {
        return this.root.client.defaultHostName;
    }

    public async openInPortal(): Promise<void> {
        await openInPortal(this.root, this.id);
    }

    public async browse(): Promise<void> {
        await openUrl(this.root.client.defaultHostUrl);
    }

    public get root(): ISiteTreeRoot {
        return this._root;
    }

    public get description(): string | undefined {
        return this._state && this._state.toLowerCase() !== 'running' ? this._state : undefined;
    }

    public get logStreamLabel(): string {
        return this.root.client.fullName;
    }

    public async refreshImpl(): Promise<void> {
        try {
            this._state = await this.root.client.getState();
        } catch {
            this._state = 'Unknown';
        }
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public get id(): string {
        return this.root.client.id;
    }

    public async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzExtTreeItem[]> {
        const siteConfig: WebSiteManagementModels.SiteConfig = await this.root.client.getSiteConfig();
        const sourceControl: WebSiteManagementModels.SiteSourceControl = await this.root.client.getSourceControl();
        this.deploymentsNode = new DeploymentsTreeItem(this, this.root.client, siteConfig, sourceControl);
        return [this.appSettingsNode, this._connectionsNode, this.deploymentsNode, this._siteFilesNode, this._logFilesNode, this._webJobsNode];
    }

    public compareChildrenImpl(ti1: AzureTreeItem<ISiteTreeRoot>, ti2: AzureTreeItem<ISiteTreeRoot>): number {
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
                    return this._connectionsNode;
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

    public async deleteTreeItemImpl(): Promise<void> {
        await deleteSite(this.root.client);
    }

    public async isHttpLogsEnabled(): Promise<boolean> {
        const logsConfig: WebSiteManagementModels.SiteLogsConfig = await this.root.client.getLogsConfig();
        return !!(logsConfig.httpLogs && logsConfig.httpLogs.fileSystem && logsConfig.httpLogs.fileSystem.enabled);
    }

    public async enableHttpLogs(): Promise<void> {
        const logsConfig: WebSiteManagementModels.SiteLogsConfig = {
            httpLogs: {
                fileSystem: {
                    enabled: true,
                    retentionInDays: 7,
                    retentionInMb: 35
                }
            }
        };

        await this.root.client.updateLogsConfig(logsConfig);
    }
}

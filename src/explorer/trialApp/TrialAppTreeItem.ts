/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppSettingsTreeItem, DeploymentsTreeItem, LogFilesTreeItem, SiteFilesTreeItem } from 'vscode-azureappservice';
import { AzExtTreeItem, GenericTreeItem, IActionContext } from 'vscode-azureextensionui';
import { ext } from '../../extensionVariables';
import { localize } from '../../localize';
import { openUrl } from '../../utils/openUrl';
import { getThemedIconPath } from '../../utils/pathUtils';
import { AzureAccountTreeItem } from '../AzureAccountTreeItem';
import { ISiteTreeItem } from '../ISiteTreeItem';
import { SiteTreeItemBase } from '../SiteTreeItemBase';
import { ITrialAppMetadata } from './ITrialAppMetadata';
import { TrialAppClient } from './TrialAppClient';

const settingsToHide: string[] = [
    'SCM_BUILD_ARGS',
    'SCM_COMMAND_IDLE_TIMEOUT',
    'SCM_LOGSTREAM_TIMEOUT',
    'SCM_TRACE_LEVEL',
    'SCM_USE_LIBGIT2SHARP_REPOSITORY',
    'SITE_BASH_GIT_URL',
    'SITE_GIT_URL',
    'SITE_SITEKEY',
    'WEBSITE_AUTH_ENABLED',
    'WEBSITE_NODE_DEFAULT_VERSION',
    'WEBSITE_SITE_NAME'
];

export class TrialAppTreeItem extends SiteTreeItemBase implements ISiteTreeItem {
    public static contextValue: string = 'trialApp';

    public contextValue: string = TrialAppTreeItem.contextValue;
    public client: TrialAppClient;
    public logFilesNode: LogFilesTreeItem;
    public deploymentsNode: TrialAppDeploymentsTreeItem;

    private readonly _appSettingsTreeItem: TrialAppApplicationSettingsTreeItem;
    private readonly _siteFilesNode: SiteFilesTreeItem;
    private readonly _tutorialNode: GenericTreeItem;

    private constructor(parent: AzureAccountTreeItem, client: TrialAppClient) {
        super(parent);
        this.client = client;
        this._appSettingsTreeItem = new TrialAppApplicationSettingsTreeItem(this, this.client, false, settingsToHide);
        this._siteFilesNode = new SiteFilesTreeItem(this, this.client, false);
        this._tutorialNode = new GenericTreeItem(this, { label: 'Show tutorial', commandId: 'appService.ShowTutorial', contextValue: 'showTutorial', iconPath: getThemedIconPath('book') });
        this.logFilesNode = new LogFilesTreeItem(this, this.client);
        this.deploymentsNode = new TrialAppDeploymentsTreeItem(this, this.client, {}, {});

        // seconds * ms
        const interval: number = 60 * 1000;
        const intervalId: NodeJS.Timeout = setInterval(
            async () => {
                if (this.client.isExpired) {
                    await ext.azureAccountTreeItem.refresh();
                } else if (ext.azureAccountTreeItem.trialAppNode === this) {
                    await this.refresh();
                    return;
                }
                clearInterval(intervalId);
            },
            interval
        );
    }

    public static async createTrialAppTreeItem(parent: AzureAccountTreeItem, loginSession: string): Promise<TrialAppTreeItem> {
        const client: TrialAppClient = await TrialAppClient.createTrialAppClient(loginSession);
        return new TrialAppTreeItem(parent, client);
    }

    public get logStreamLabel(): string {
        return this.metadata.hostName;
    }

    public get metadata(): ITrialAppMetadata {
        return this.client.metadata;
    }

    public get label(): string {
        return this.metadata.siteName ? this.metadata.siteName : localize('nodeJsTrialApp', 'NodeJS Trial App');
    }

    private get minutesLeft(): number {
        return (this.metadata.timeLeft / 60);
    }

    public get description(): string {
        return this.client.isExpired ?
            localize('expired', 'Expired') : `${this.minutesLeft.toFixed(0)} ${localize('minutesRemaining', 'min. remaining')}`;
    }

    public get id(): string {
        return `trialApp${this.defaultHostName}`;
    }

    public get defaultHostName(): string {
        return this.client.fullName;
    }

    public get defaultHostUrl(): string {
        return this.client.defaultHostUrl;
    }

    public async isHttpLogsEnabled(): Promise<boolean> {
        return true;
    }

    public async loadMoreChildrenImpl(_clearCache: boolean, _context: IActionContext): Promise<AzExtTreeItem[]> {
        return [this._tutorialNode, this._appSettingsTreeItem, this.deploymentsNode, this._siteFilesNode, this.logFilesNode];
    }
    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public async browse(): Promise<void> {
        await openUrl(this.defaultHostUrl);
    }

    public async refreshImpl(): Promise<void> {
        this.client = await TrialAppClient.createTrialAppClient(this.metadata.loginSession);
    }

    public isAncestorOfImpl?(contextValue: string | RegExp): boolean {
        return contextValue === TrialAppTreeItem.contextValue;
    }

    public compareChildrenImpl(item1: AzExtTreeItem, item2: AzExtTreeItem): number {
        // tutorial node at top
        if (item1 instanceof GenericTreeItem) {
            return -1;
        }
        if (item2 instanceof GenericTreeItem) {
            return 1;
        }
        return super.compareChildrenImpl(item1, item2);
    }
}

// different context value to change actions in context menu
class TrialAppApplicationSettingsTreeItem extends AppSettingsTreeItem {
    public contextValue: string = 'applicationSettingsTrialApp';
}

export class TrialAppDeploymentsTreeItem extends DeploymentsTreeItem { }

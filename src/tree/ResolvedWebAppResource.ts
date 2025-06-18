/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type AppServicePlan, type SiteConfig, type SiteLogsConfig, type SiteSourceControl } from '@azure/arm-appservice';
import { DeleteLastServicePlanStep, DeleteSiteStep, DeploymentTreeItem, DeploymentsTreeItem, FolderTreeItem, LogFilesTreeItem, ParsedSite, SiteFilesTreeItem, createWebSiteClient } from '@microsoft/vscode-azext-azureappservice';
import { AppSettingTreeItem, AppSettingsTreeItem } from '@microsoft/vscode-azext-azureappsettings';
import { AzureWizard, DeleteConfirmationStep, nonNullProp, type AzExtTreeItem, type IActionContext, type ISubscriptionContext, type TreeItemIconPath } from '@microsoft/vscode-azext-utils';
import { type ResolvedAppResourceBase, } from '@microsoft/vscode-azext-utils/hostapi';
import { type ViewPropertiesModel } from '@microsoft/vscode-azureresources-api';
import { githubCommitContextValueRegExp } from '../commands/deployments/viewCommitInGitHub';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { createActivityContext } from '../utils/activityUtils';
import { matchContextValue } from '../utils/contextUtils';
import { nonNullValue } from '../utils/nonNull';
import { openUrl } from '../utils/openUrl';
import { getIconPath, getThemedIconPath } from '../utils/pathUtils';
import { type AppServiceQueryResult } from '../WebAppResolver';
import { CosmosDBConnection } from './CosmosDBConnection';
import { CosmosDBTreeItem } from './CosmosDBTreeItem';
import { DeploymentSlotsNATreeItem, DeploymentSlotsTreeItem } from './DeploymentSlotsTreeItem';
import { type ISiteTreeItem } from './ISiteTreeItem';
import { NotAvailableTreeItem } from './NotAvailableTreeItem';
import { type SiteTreeItem } from './SiteTreeItem';
import { WebJobsNATreeItem, WebJobsTreeItem } from './WebJobsTreeItem';

type ResolvedWebAppResourceOptions = {
    showLocationAsTreeItemDescription?: boolean;
};

export function isResolvedWebAppResource(ti: unknown): ti is ResolvedWebAppResource {
    return (ti as unknown as ResolvedWebAppResource).instance === ResolvedWebAppResource.instance;
}

export class ResolvedWebAppResource implements ResolvedAppResourceBase, ISiteTreeItem {
    public site!: ParsedSite;

    public static instance = 'resolvedWebApp';
    public readonly instance = ResolvedWebAppResource.instance;

    public contextValuesToAdd?: string[] | undefined;
    public maskedValuesToAdd: string[] = [];

    public static webAppContextValue: string = 'azAppWebApp';
    public static slotContextValue: string = 'azAppSlot';

    commandId?: string | undefined;
    tooltip?: string | undefined;
    commandArgs?: unknown[] | undefined;

    public deploymentSlotsNode: DeploymentSlotsTreeItem | DeploymentSlotsNATreeItem | undefined;
    public deploymentsNode: DeploymentsTreeItem | undefined;
    public appSettingsNode!: AppSettingsTreeItem;
    private _connectionsNode!: CosmosDBTreeItem;
    private _siteFilesNode!: SiteFilesTreeItem;
    private _logFilesNode!: LogFilesTreeItem;
    private _webJobsNode!: WebJobsTreeItem | WebJobsNATreeItem;

    private _subscription: ISubscriptionContext;

    constructor(subscription: ISubscriptionContext, readonly queryResult: AppServiceQueryResult, readonly options?: ResolvedWebAppResourceOptions) {

        this._subscription = subscription;
        // this.contextValuesToAdd = [this.site.isSlot ? ResolvedWebAppResource.slotContextValue : ResolvedWebAppResource.webAppContextValue];

        // const valuesToMask = [
        //     this.site.siteName, this.site.slotName, this.site.defaultHostName, this.site.resourceGroup,
        //     this.site.planName, this.site.planResourceGroup, this.site.kuduHostName, this.site.gitUrl,
        //     this.site.rawSite.repositorySiteName, ...(this.site.rawSite.hostNames || []), ...(this.site.rawSite.enabledHostNames || [])
        // ];

        // for (const v of valuesToMask) {
        //     if (v) {
        //         this.maskedValuesToAdd.push(v);
        //     }
        // }
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
        if (this._state?.toLowerCase() !== 'running') {
            return this._state;
        }
        return this.options?.showLocationAsTreeItemDescription ? this.site.location : undefined;
    }

    public get logStreamLabel(): string {
        return this.site.fullName;
    }

    public get viewProperties(): ViewPropertiesModel {
        return {
            data: this.site,
            label: this.name,
        }
    }

    public async refreshImpl(context: IActionContext): Promise<void> {
        const client = await createWebSiteClient({ ...context, ...this._subscription });
        this.site = new ParsedSite(await client.webApps.get(this.queryResult.resourceGroup, this.queryResult.name), this._subscription);
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public get id(): string {
        return this.queryResult.id;
    }

    public get label(): string {
        return this.site?.slotName ?? this.queryResult.name;
    }

    public get name(): string {
        return this.label;
    }

    private get _state(): string | undefined {
        return this.queryResult.status;
    }

    public get iconPath(): TreeItemIconPath {
        return this.site?.isSlot ? getThemedIconPath('DeploymentSlot_color') : getIconPath('WebApp');
    }

    public async loadMoreChildrenImpl(_clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]> {
        await this.refreshImpl(context);
        const proxyTree: SiteTreeItem = this as unknown as SiteTreeItem;

        this.appSettingsNode = new AppSettingsTreeItem(proxyTree, this.site, ext.prefix, {
            contextValuesToAdd: ['appService']
        });
        this._connectionsNode = new CosmosDBTreeItem(proxyTree, this.site);
        this._siteFilesNode = new SiteFilesTreeItem(proxyTree, {
            site: this.site,
            isReadOnly: false,
            contextValuesToAdd: ['appService']
        });
        this._logFilesNode = new LogFilesTreeItem(proxyTree, {
            site: this.site,
            contextValuesToAdd: ['appService']
        });
        // Can't find actual documentation on this, but the portal claims it and this feedback suggests it's not planned https://aka.ms/AA4q5gi
        this._webJobsNode = this.site.isLinux ? new WebJobsNATreeItem(proxyTree) : new WebJobsTreeItem(proxyTree);

        const client = await this.site.createClient(context);
        const siteConfig: SiteConfig = await client.getSiteConfig();
        const sourceControl: SiteSourceControl = await client.getSourceControl();
        this.deploymentsNode = new DeploymentsTreeItem(proxyTree, {
            site: this.site,
            siteConfig,
            sourceControl,
            contextValuesToAdd: ['appService']
        });

        const children: AzExtTreeItem[] = [this.appSettingsNode, this._connectionsNode, this.deploymentsNode, this._siteFilesNode, this._logFilesNode, this._webJobsNode];

        if (!this.site.isSlot) {
            let tier: string | undefined;
            let asp: AppServicePlan | undefined;
            try {
                const client = await this.site.createClient(context);
                asp = await client.getAppServicePlan();
                tier = asp && asp.sku && asp.sku.tier;
            } catch (err) {
                // ignore this error, we don't want to block users for deployment slots
                tier = 'unknown';
            }

            this.deploymentSlotsNode = tier && /^(basic|free|shared)$/i.test(tier) ? new DeploymentSlotsNATreeItem(proxyTree, nonNullProp(nonNullValue(asp), 'id')) : new DeploymentSlotsTreeItem(proxyTree);
            children.push(this.deploymentSlotsNode);
        }

        return children;
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
        if (!this.site.isSlot) {
            for (const expectedContextValue of expectedContextValues) {
                switch (expectedContextValue) {
                    case DeploymentSlotsTreeItem.contextValue:
                    case ResolvedWebAppResource.slotContextValue:
                        return this.deploymentSlotsNode;
                    default:
                }
            }
        }

        for (const expectedContextValue of expectedContextValues) {

            if (expectedContextValue instanceof RegExp) {
                const appSettingsContextValues = [AppSettingsTreeItem.contextValue, AppSettingTreeItem.contextValue];
                if (matchContextValue(expectedContextValue, appSettingsContextValues)) {
                    return this.appSettingsNode;
                }
                const deploymentsContextValues = [githubCommitContextValueRegExp, DeploymentsTreeItem.contextValueConnected, DeploymentsTreeItem.contextValueUnconnected, DeploymentTreeItem.contextValue];
                if (matchContextValue(expectedContextValue, deploymentsContextValues)) {
                    return this.deploymentsNode;
                }
                const slotsContextValues = [DeploymentSlotsTreeItem.contextValue, ResolvedWebAppResource.slotContextValue];
                if (matchContextValue(expectedContextValue, slotsContextValues)) {
                    return this.deploymentSlotsNode;
                }
                if (matchContextValue(expectedContextValue, [FolderTreeItem.contextValue])) {
                    return this._siteFilesNode;
                }
            }

            switch (expectedContextValue) {
                case CosmosDBTreeItem.contextValueInstalled:
                case CosmosDBTreeItem.contextValueNotInstalled:
                case CosmosDBConnection.contextValue:
                    return this._connectionsNode;
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
        const wizardContext = Object.assign(context, {
            ...(await createActivityContext()),
            site: this.site,
        });

        const confirmMessage: string = this.site.isSlot ?
            localize('confirmDeleteSlot', 'Are you sure you want to delete slot "{0}"?', this.site.fullName) :
            localize('confirmDeleteWebApp', 'Are you sure you want to delete web app "{0}"?', this.site.fullName);

        const title: string = this.site.isSlot ?
            localize('deleteSlot', 'Delete slot "{0}"', this.site.fullName) :
            localize('deleteWebApp', 'Delete web app "{0}"', this.site.fullName);

        const wizard = new AzureWizard(wizardContext, {
            promptSteps: [new DeleteConfirmationStep(confirmMessage), new DeleteLastServicePlanStep()],
            executeSteps: [new DeleteSiteStep()],
            title
        });

        await wizard.prompt();
        await wizard.execute();
    }

    public async isHttpLogsEnabled(context: IActionContext): Promise<boolean> {
        const client = await this.site.createClient(context);
        const logsConfig: SiteLogsConfig = await client.getLogsConfig();
        return !!(logsConfig.httpLogs && logsConfig.httpLogs.fileSystem && logsConfig.httpLogs.fileSystem.enabled);
    }

    public async enableLogs(context: IActionContext): Promise<void> {
        const logsConfig: SiteLogsConfig = {};
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

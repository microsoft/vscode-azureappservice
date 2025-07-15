/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type AppServicePlan, type Site, type SiteLogsConfig } from '@azure/arm-appservice';
import { DeleteLastServicePlanStep, DeleteSiteStep, DeploymentTreeItem, DeploymentsTreeItem, FolderTreeItem, LogFilesTreeItem, ParsedSite, SiteFilesTreeItem, createWebSiteClient } from '@microsoft/vscode-azext-azureappservice';
import { AppSettingTreeItem, AppSettingsTreeItem } from '@microsoft/vscode-azext-azureappsettings';
import { AzureWizard, DeleteConfirmationStep, callWithTelemetryAndErrorHandling, nonNullProp, type AzExtTreeItem, type IActionContext, type ISubscriptionContext, type TreeItemIconPath } from '@microsoft/vscode-azext-utils';
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
import { type AppServiceDataModel } from '../WebAppResolver';
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
    protected _site: ParsedSite | undefined = undefined;
    public dataModel!: AppServiceDataModel;

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
    private _siteFilesNode!: SiteFilesTreeItem;
    private _logFilesNode!: LogFilesTreeItem;
    private _webJobsNode!: WebJobsTreeItem | WebJobsNATreeItem;

    private _subscription: ISubscriptionContext;

    constructor(subscription: ISubscriptionContext, site: Site | undefined, dataModel?: AppServiceDataModel, readonly options?: ResolvedWebAppResourceOptions) {
        if (site) {
            this._site = new ParsedSite(site, subscription);
            this.addValuesToMask(this.site);
            this.dataModel = this.createDataModelFromSite(site);
            this.contextValuesToAdd = [this.site?.isSlot ? ResolvedWebAppResource.slotContextValue : ResolvedWebAppResource.webAppContextValue];
        } else if (dataModel) {
            // need to initialize site later
            this.dataModel = dataModel;
            this.contextValuesToAdd = [ResolvedWebAppResource.webAppContextValue];
        }

        this._subscription = subscription;
    }

    private addValuesToMask(site: ParsedSite): void {
        const valuesToMask = [
            site.siteName, site.slotName, site.defaultHostName, site.resourceGroup,
            site.planName, site.planResourceGroup, site.kuduHostName, site.gitUrl,
            site.rawSite.repositorySiteName, ...(site.rawSite.hostNames || []), ...(site.rawSite.enabledHostNames || [])
        ];

        for (const v of valuesToMask) {
            if (v) {
                this.maskedValuesToAdd.push(v);
            }
        }
    }

    private createDataModelFromSite(site: Site): AppServiceDataModel {
        return {
            id: site.id ?? '',
            name: site.name ?? '',
            type: site.type ?? '',
            kind: site.kind ?? '',
            location: site.location,
            resourceGroup: nonNullProp(site, 'resourceGroup'),
            status: site.state ?? 'Unknown',
        };
    }

    public async initSite(context: IActionContext): Promise<void> {
        if (!this._site) {
            const webClient = await createWebSiteClient({ ...context, ...this._subscription });
            const rawSite = await webClient.webApps.get(this.dataModel.resourceGroup, this.dataModel.name);
            this._site = new ParsedSite(rawSite, this._subscription);
            this.addValuesToMask(this._site);
        }
    }

    public get site(): ParsedSite {
        if (!this._site) {
            void callWithTelemetryAndErrorHandling('functionApp.initSiteFailed', async (context: IActionContext) => {
                // try to lazy load the site if it hasn't been initialized yet
                void this.initSite(context);
            });
            throw new Error(localize('siteNotSet', 'Site is not initialized. Please try again in a moment.'));
        }
        return this._site;
    }

    public get defaultHostUrl(): string {
        return this.site.defaultHostUrl;
    }

    public get defaultHostName(): string {
        return this.site.defaultHostName;
    }

    public async browse(context: IActionContext): Promise<void> {
        await this.initSite(context);
        await openUrl(this.site.defaultHostUrl);
    }

    public get description(): string | undefined {
        if (this._state?.toLowerCase() !== 'running') {
            return this._state;
        }
        return this.options?.showLocationAsTreeItemDescription ? this.dataModel.location : undefined;
    }

    public get logStreamLabel(): string {
        return this.site.fullName;
    }

    public get viewProperties(): ViewPropertiesModel {
        return {
            label: this.name,
            getData: () => this.getData(),
        }
    }

    private async getData(): Promise<Site> {
        if (!this._site) {
            await callWithTelemetryAndErrorHandling('getData.initSite', async (context: IActionContext) => {
                await this.initSite(context);
            });
        }
        return this._site as Site;
    }

    public async refreshImpl(context: IActionContext): Promise<void> {
        await this.initSite(context);
        const client = await this.site.createClient(context);
        this._site = new ParsedSite(nonNullValue(await client.getSite(), 'site'), this._subscription);
        this.dataModel = this.createDataModelFromSite(this.site.rawSite);
        this.addValuesToMask(this.site);
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public get id(): string {
        return this.dataModel.id;
    }

    public get label(): string {
        if (this.dataModel.type.includes('slots')) {
            return this.site.slotName ?? this.dataModel.name;
        }
        return this.dataModel.name;
    }

    public get name(): string {
        return this.label;
    }

    private get _state(): string | undefined {
        return this.dataModel.status;
    }

    public get iconPath(): TreeItemIconPath {
        return this.site?.isSlot ? getThemedIconPath('DeploymentSlot_color') : getIconPath('WebApp');
    }

    public async loadMoreChildrenImpl(_clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]> {
        await this.initSite(context);
        const proxyTree: SiteTreeItem = this as unknown as SiteTreeItem;

        this.appSettingsNode = new AppSettingsTreeItem(proxyTree, this.site, ext.prefix, {
            contextValuesToAdd: ['appService']
        });
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
        this.deploymentsNode = new DeploymentsTreeItem(proxyTree, {
            site: this.site,
            contextValuesToAdd: ['appService']
        });

        const children: AzExtTreeItem[] = [this.appSettingsNode, this.deploymentsNode, this._siteFilesNode, this._logFilesNode, this._webJobsNode];

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
        if (!this.site?.isSlot) {
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
        await this.initSite(context);
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
        await this.initSite(context);
        const client = await this.site.createClient(context);
        const logsConfig: SiteLogsConfig = await client.getLogsConfig();
        return !!(logsConfig.httpLogs && logsConfig.httpLogs.fileSystem && logsConfig.httpLogs.fileSystem.enabled);
    }

    public async enableLogs(context: IActionContext): Promise<void> {
        const logsConfig: SiteLogsConfig = {};
        await this.initSite(context);
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

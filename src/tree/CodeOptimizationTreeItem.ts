import { type ApplicationInsightsComponent, type ApplicationInsightsManagementClient } from '@azure/arm-appinsights';
import { type StringDictionary } from '@azure/arm-appservice';
import { createAppInsightsClient } from '@microsoft/vscode-azext-azureappservice';
import { AzExtParentTreeItem, GenericTreeItem, type AzExtTreeItem, type IActionContext, type IGenericTreeItemOptions, type TreeItemIconPath } from '@microsoft/vscode-azext-utils';
import { ThemeIcon, TreeItemCollapsibleState } from 'vscode';
import { localize } from '../localize';
import { getDataplaneIssues, type DataplaneIssue } from '../utils/perfIssuesUtils';
import { type SiteTreeItem } from './SiteTreeItem';

const label: string = localize('codeOptimizations', 'Code Optimizations');
export class CodeOptimizationsTreeItem extends AzExtParentTreeItem {
    public readonly label: string = label;
    public static contextValue: string = 'codeOptimizations';
    public readonly contextValue: string = CodeOptimizationsTreeItem.contextValue;
    declare public parent: SiteTreeItem;
    private _appInsightsComponent: ApplicationInsightsComponent | undefined;

    constructor(parent: SiteTreeItem) {
        super(parent);
    }

    public get id(): string {
        return this._appInsightsComponent?.id ?? `${this.parent.site.id}/codeOptimizations`;
    }

    public get iconPath(): TreeItemIconPath {
        return new ThemeIcon('pulse');
    }

    public async loadMoreChildrenImpl(clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]> {
        const client = await this.parent.site.createClient(context);
        const settings: StringDictionary = await client.listApplicationSettings();
        const appInsightsComponent = await this.resolveAppInsightsComponent(context);

        if (!appInsightsComponent) {
            return [new GenericTreeItem(this, {
                id: "applicationInsightsNotEnabled",
                label: 'No application insights resource linked. Please add or create an Application Insights resource to get code optimizations',
                contextValue: 'applicationInsightsNotEnabled',
                iconPath: new ThemeIcon('error')
            })];
        }

        if (!this.parent.site.isLinux && (this.isUndefinedOrDefaultValue(settings?.properties?.APPINSIGHTS_PROFILERFEATURE_VERSION, 'default') || this.isUndefinedOrDefaultValue(settings?.properties?.XDT_MicrosoftApplicationInsights_Mode, 'default') || !appInsightsComponent)) {
            return [new GenericTreeItem(this, {
                id: "profilerNotEnabled",
                label: 'Enable profiling for code optimization',
                contextValue: 'profilerNotEnabled',
                iconPath: new ThemeIcon('error')
            })];
        }

        // Get Code Optimization
        const issues = await getDataplaneIssues(appInsightsComponent.appId || "", Object.assign(context, this.parent?.subscription));
        if (issues instanceof Array) {
            context.telemetry.properties.codeOptimizationCount = String(issues.length);
            if (issues.length > 0) {
                return issues.map(issue => {
                    const title = `\`${issue.function}\` is causing high ${issue.issueCategory} usage.`;
                    return new CodeOptimizationsIssueTreeItem(this, { id: issue.key, label: title, contextValue: 'codeOptimizationIssue' }, issue);
                });
            }
            else {
                // For linux we dont know if the profile is enabled and enabling it is not as easy.
                // So add an option to prompt co pilot to add support.
                if (this.parent.site.isLinux) {
                    return [new GenericTreeItem(this, {
                        id: "noResultLinux",
                        label: 'No Code Optimizations found. It may take some time to appear',
                        contextValue: 'codeOptimizationNoResultLinux',
                        iconPath: new ThemeIcon('pass-filled')
                    })];
                } else {
                    return [new GenericTreeItem(this, {
                        id: "noResult",
                        label: 'No CodeOptimizations found. It may take some time to appear',
                        contextValue: 'codeOptimization',
                        iconPath: new ThemeIcon('pass-filled')
                    })];
                }
            }
        }

        // Error case
        context.telemetry.properties.codeOptimizationCount = 'error';
        return [new GenericTreeItem(this, { id: "errorcodeOptimization", label: 'Unable to get code optimizations', contextValue: 'codeOptimization' })];
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public async getPortalUrl(context: IActionContext): Promise<string> {
        const appInsightsComponent = await this.resolveAppInsightsComponent(context);
        return `${this.subscription.environment.portalUrl}/${this.subscription.tenantId}/#view/Microsoft_Azure_CodeOptimizations/CodeOptimizationsBlade/ComponentId~/%7B%22TenantId%22%3A%22${this.subscription.tenantId}%22%2C%22SubscriptionId%22%3A%22${this.subscription.subscriptionId}%22%2C%22ResourceGroup%22%3A%22${this.parent.site.resourceGroup}%22%2C%22Name%22%3A%22${appInsightsComponent?.name ?? ''}%22%2C%22LinkedApplicationType%22%3A0%2C%22ResourceId%22%3A%22${encodeURIComponent(appInsightsComponent?.id ?? '')}%22%2C%22ResourceType%22%3A%22microsoft.insights%2Fcomponents%22%2C%22IsAzureFirst%22%3Afalse%7D/OpenedFrom/app-services-vscode/AppId/${appInsightsComponent?.appId ?? ''}`
    }

    public async getAppInsightsResource(context: IActionContext): Promise<ApplicationInsightsComponent | undefined> {
        return this.resolveAppInsightsComponent(context);
    }

    private isUndefinedOrDefaultValue(value: string | undefined, defaultValue: string): boolean {
        return (value === undefined || value === null || value === defaultValue);
    }

    private async resolveAppInsightsComponent(context: IActionContext): Promise<ApplicationInsightsComponent | undefined> {
        if (this._appInsightsComponent) {
            return this._appInsightsComponent;
        }

        const client = await this.parent.site.createClient(context);
        const settings: StringDictionary = await client.listApplicationSettings();

        // Extract instrumentation key from connection string or the dedicated app setting
        const connectionString = settings?.properties?.APPLICATIONINSIGHTS_CONNECTION_STRING;
        const instrumentationKey = connectionString
            ?.split(';')
            .find(part => part.startsWith('InstrumentationKey='))
            ?.split('=')[1]
            ?? settings?.properties?.APPINSIGHTS_INSTRUMENTATIONKEY;

        if (!instrumentationKey) {
            return undefined;
        }

        // Match against listed App Insights components by instrumentation key
        const appInsightsClient: ApplicationInsightsManagementClient = await createAppInsightsClient([context, this.subscription]);
        for await (const component of appInsightsClient.components.list()) {
            if (component.instrumentationKey === instrumentationKey) {
                this._appInsightsComponent = component;
                return component;
            }
        }

        return undefined;
    }
}

export class CodeOptimizationsIssueTreeItem extends AzExtParentTreeItem {
    public static contextValue: string = 'codeOptimizationIssue';
    public readonly contextValue: string = CodeOptimizationsTreeItem.contextValue;
    public issue: DataplaneIssue;
    public label: string;
    declare public parent: CodeOptimizationsTreeItem;

    constructor(parent: CodeOptimizationsTreeItem, options: IGenericTreeItemOptions, issue: DataplaneIssue) {
        super(parent);
        this.label = options.label;
        this.id = options.id;
        this.contextValue = options.contextValue;
        this.issue = issue;
    }

    public get iconPath(): TreeItemIconPath {
        return new ThemeIcon('warning');
    }

    public loadMoreChildrenImpl(_clearCache: boolean, _context: IActionContext): Promise<AzExtTreeItem[]> {
        return Promise.resolve([]);
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public initialCollapsibleState: TreeItemCollapsibleState | undefined = TreeItemCollapsibleState.None;

    public async getPortalUrl(context: IActionContext): Promise<string> {
        return `${await this.parent.getPortalUrl(context)}/key/${this.issue.key}`;
    }
}

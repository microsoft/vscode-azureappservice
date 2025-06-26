import { type Site } from "@azure/arm-appservice";
import { getResourceGroupFromId } from "@microsoft/vscode-azext-azureutils";
import { callWithTelemetryAndErrorHandling, nonNullProp, type IActionContext, type ISubscriptionContext } from "@microsoft/vscode-azext-utils";
import { type AppResource, type AppResourceResolver } from "@microsoft/vscode-azext-utils/hostapi";
import { ResolvedWebAppResource } from "./tree/ResolvedWebAppResource";
import { createResourceGraphClient, createWebSiteClient } from "./utils/azureClients";
import { getGlobalSetting } from "./vsCodeConfig/settings";

export type AppServiceDataModel = {
    id: string,
    name: string,
    type: string,
    kind: string,
    location: string,
    resourceGroup: string,
    status: string,
}

type AppServiceQueryModel = {
    properties: {
        sku: string,
        state: string
    },
    location: string,
    id: string,
    type: string,
    kind: string,
    name: string,
    resourceGroup: string
}
export class WebAppResolver implements AppResourceResolver {
    private loaded: boolean = false;
    private siteCacheLastUpdated = 0;
    private siteCache: Map<string, AppServiceDataModel> = new Map<string, AppServiceDataModel>();
    private siteNameCounter: Map<string, number> = new Map<string, number>();
    private listWebAppsTask: Promise<void> | undefined;

    public async resolveResource(subContext: ISubscriptionContext, resource: AppResource): Promise<ResolvedWebAppResource | undefined> {
        return await callWithTelemetryAndErrorHandling('resolveResource', async (context: IActionContext) => {
            if (this.siteCacheLastUpdated < Date.now() - 1000 * 3) {
                this.loaded = false;
                this.siteCache.clear();
                this.siteNameCounter.clear();
                this.siteCacheLastUpdated = Date.now();

                async function fetchAllApps(subContext: ISubscriptionContext, resolver: WebAppResolver): Promise<void> {
                    const graphClient = await createResourceGraphClient({ ...context, ...subContext });
                    const query = `resources | where type == 'microsoft.web/sites' and kind !contains 'functionapp' and kind !contains 'workflowapp'`;

                    async function fetchApps(skipToken?: string): Promise<void> {
                        const response = await graphClient.resources({
                            query,
                            subscriptions: [subContext.subscriptionId],
                            options: {
                                skipToken
                            }
                        });

                        const record = response.data as Record<string, AppServiceQueryModel>;
                        Object.values(record).forEach(data => {
                            resolver.countSiteName(nonNullProp(data, 'name'));
                            const model = {
                                id: data.id,
                                name: data.name,
                                type: data.type,
                                kind: data.kind,
                                location: data.location,
                                resourceGroup: data.resourceGroup,
                                status: data.properties?.state ?? 'Unknown',
                            } as AppServiceDataModel;
                            resolver.siteCache.set(data.id.toLowerCase(), model);
                        });

                        const nextSkipToken = response?.skipToken;
                        if (nextSkipToken) {
                            await fetchApps(nextSkipToken);
                        } else {
                            resolver.loaded = true;
                            return;
                        }
                    }

                    return await fetchApps();
                }

                this.listWebAppsTask = fetchAllApps(subContext, this);
            }

            if (!this.loaded) {
                // because resolveResource is called per resource and this is asynchronous,
                // we need to wait for the task to complete otherwise we may return before the cache is populated
                await this.listWebAppsTask;
            }
            const siteModel = this.siteCache.get(nonNullProp(resource, 'id').toLowerCase());
            let site: Site | undefined = undefined;
            if (!siteModel) {
                const client = await createWebSiteClient({ ...context, ...subContext });
                site = await client.webApps.get(getResourceGroupFromId(resource.id), nonNullProp(resource, 'name'));
                this.countSiteName(nonNullProp(resource, 'name'));
            }

            const groupBy: string | undefined = getGlobalSetting<string>('groupBy', 'azureResourceGroups');
            const hasDuplicateSiteName: boolean = (this.siteNameCounter.get(nonNullProp(resource, 'name')) ?? 1) > 1;
            context.telemetry.properties.hasDuplicateSiteName = String(hasDuplicateSiteName);

            return new ResolvedWebAppResource(subContext, site, siteModel, {
                // Multiple sites with the same name could be displayed as long as they are in different locations
                // To help distinguish these apps for our users, lookahead and determine if the location should be provided for duplicated site names
                showLocationAsTreeItemDescription: groupBy === 'resourceType' && hasDuplicateSiteName,
            });
        });
    }

    public matchesResource(resource: AppResource): boolean {
        return resource.type.toLowerCase() === 'microsoft.web/sites' && !resource.kind?.includes('functionapp');
    }

    private countSiteName(siteName: string): void {
        const count: number = (this.siteNameCounter.get(siteName) ?? 0) + 1;
        this.siteNameCounter.set(siteName, count);
    }
}

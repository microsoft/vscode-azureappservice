import { type Site } from "@azure/arm-appservice";
import { uiUtils } from "@microsoft/vscode-azext-azureutils";
import { callWithTelemetryAndErrorHandling, nonNullProp, nonNullValue, type IActionContext, type ISubscriptionContext } from "@microsoft/vscode-azext-utils";
import { type AppResource, type AppResourceResolver } from "@microsoft/vscode-azext-utils/hostapi";
import { ResolvedWebAppResource } from "./tree/ResolvedWebAppResource";
import { createWebSiteClient } from "./utils/azureClients";

export class WebAppResolver implements AppResourceResolver {

    private siteCacheLastUpdated = 0;
    private siteCache: Map<string, Site> = new Map<string, Site>();
    private listWebAppsTask: Promise<void> | undefined;

    public async resolveResource(subContext: ISubscriptionContext, resource: AppResource): Promise<ResolvedWebAppResource | undefined> {
        return await callWithTelemetryAndErrorHandling('resolveResource', async (context: IActionContext) => {
            const client = await createWebSiteClient({ ...context, ...subContext });

            if (this.siteCacheLastUpdated < Date.now() - 1000 * 3) {
                this.siteCacheLastUpdated = Date.now();
                this.listWebAppsTask = new Promise((resolve, reject) => {
                    this.siteCache.clear();
                    uiUtils.listAllIterator(client.webApps.list()).then((sites) => {
                        for (const site of sites) {
                            this.siteCache.set(nonNullProp(site, 'id').toLowerCase(), site);
                        }
                        resolve();
                    })
                        .catch((reason) => {
                            reject(reason);
                        });
                });
            }

            await this.listWebAppsTask;
            const site = this.siteCache.get(nonNullProp(resource, 'id').toLowerCase());
            return new ResolvedWebAppResource(subContext, nonNullValue(site));
        });
    }

    public matchesResource(resource: AppResource): boolean {
        return resource.type.toLowerCase() === 'microsoft.web/sites' && !resource.kind?.includes('functionapp');
    }
}

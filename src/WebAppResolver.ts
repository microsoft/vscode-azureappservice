import { parseAzureResourceId } from "@microsoft/vscode-azext-azureutils";
import { callWithTelemetryAndErrorHandling, IActionContext, ISubscriptionContext, nonNullProp } from "@microsoft/vscode-azext-utils";
import { AppResource, AppResourceResolver } from "@microsoft/vscode-azext-utils/hostapi";
import { ResolvedWebAppResource } from "./tree/ResolvedWebAppResource";
import { createWebSiteClient } from "./utils/azureClients";

export class WebAppResolver implements AppResourceResolver {
    public async resolveResource(subContext: ISubscriptionContext, resource: AppResource): Promise<ResolvedWebAppResource | null> {
        return await callWithTelemetryAndErrorHandling('resolveResource', async (context: IActionContext) => {
            try {
                const client = await createWebSiteClient({ ...context, ...subContext });
                const site = await client.webApps.get(parseAzureResourceId(nonNullProp(resource, 'id')).resourceGroup, nonNullProp(resource, 'name'));
                return new ResolvedWebAppResource(subContext, site);

            } catch (e) {
                console.error({ ...context, ...subContext });
                throw e;
            }
        }) ?? null;
    }

    public matchesResource(resource: AppResource): boolean {
        return resource.type.toLowerCase() === 'microsoft.web/sites' && !resource.kind?.includes('functionapp');
    }
}

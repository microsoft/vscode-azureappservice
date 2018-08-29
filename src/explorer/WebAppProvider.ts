/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceManagementClient } from 'azure-arm-resource';
import { Provider } from 'azure-arm-resource/lib/resource/models';
import { WebSiteManagementClient } from 'azure-arm-website';
import { Site, WebAppCollection } from 'azure-arm-website/lib/models';
import { workspace, WorkspaceConfiguration } from 'vscode';
import { createWebApp, SiteClient } from 'vscode-azureappservice';
import { addExtensionUserAgent, callWithTelemetryAndErrorHandling, createAzureClient, IActionContext, IAzureNode, IAzureTreeItem, IChildProvider, UserCancelledError } from 'vscode-azureextensionui';
import { configurationSettings, extensionPrefix } from '../constants';
import { InvalidWebAppTreeItem } from './InvalidWebAppTreeItem';
import { WebAppTreeItem } from './WebAppTreeItem';

export class WebAppProvider implements IChildProvider {
    public readonly childTypeLabel: string = 'Web App';

    private _nextLink: string | undefined;
    private _verifiedSubscriptions: string[] = [];

    public hasMoreChildren(): boolean {
        return this._nextLink !== undefined;
    }

    public async loadMoreChildren(node: IAzureNode, clearCache: boolean): Promise<IAzureTreeItem[]> {
        await this.ensureProviderRegistered(node);

        if (clearCache) {
            this._nextLink = undefined;
        }

        const client: WebSiteManagementClient = new WebSiteManagementClient(node.credentials, node.subscriptionId, node.environment.resourceManagerEndpointUrl);
        addExtensionUserAgent(client);
        const webAppCollection: WebAppCollection = this._nextLink === undefined ?
            await client.webApps.list() :
            await client.webApps.listNext(this._nextLink);

        this._nextLink = webAppCollection.nextLink;

        const treeItems: IAzureTreeItem[] = [];
        await Promise.all(webAppCollection
            .map(async (s: Site) => {
                try {
                    const siteClient: SiteClient = new SiteClient(s, node);
                    if (!siteClient.isFunctionApp) {
                        treeItems.push(new WebAppTreeItem(siteClient));
                    }
                } catch (error) {
                    if (s.name) {
                        treeItems.push(new InvalidWebAppTreeItem(s.name, error));
                    }
                }
            }));
        return treeItems;
    }

    public async createChild(node: IAzureNode<IAzureTreeItem>, showCreatingNode: (label: string) => void, actionContext: IActionContext): Promise<IAzureTreeItem> {
        await this.ensureProviderRegistered(node);

        const workspaceConfig: WorkspaceConfiguration = workspace.getConfiguration(extensionPrefix);
        const advancedCreation: boolean | undefined = workspaceConfig.get(configurationSettings.advancedCreation);
        const newSite: Site | undefined = await createWebApp(actionContext, node, showCreatingNode, advancedCreation);
        if (newSite === undefined) {
            throw new UserCancelledError();
        } else {
            const siteClient: SiteClient = new SiteClient(newSite, node);
            return new WebAppTreeItem(siteClient);
        }
    }

    private async ensureProviderRegistered(node: IAzureNode): Promise<void> {
        if (!this._verifiedSubscriptions.some((id: string) => node.subscriptionId === id)) {
            // Hide errors from this check and mark subscription as 'verified' even if it fails
            // For example, maybe the user doesn't have permissions to view providers on this subscription, but the provider has already been registered
            await callWithTelemetryAndErrorHandling('appService.ensureProviderRegistered', async function (this: IActionContext): Promise<void> {
                this.suppressErrorDisplay = true;

                const resourceClient: ResourceManagementClient = createAzureClient(node, ResourceManagementClient);
                const providerName: string = 'Microsoft.Web';
                const provider: Provider = await resourceClient.providers.get(providerName);
                if (!provider.registrationState || provider.registrationState.toLowerCase() === 'unregistered') {
                    await resourceClient.providers.register(providerName);
                }
            });

            this._verifiedSubscriptions.push(node.subscriptionId);
        }
    }
}

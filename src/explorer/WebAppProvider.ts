/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import WebSiteManagementClient = require('azure-arm-website');
import { AppServicePlan, Site, WebAppCollection } from 'azure-arm-website/lib/models';
import { createWebApp, SiteClient } from 'vscode-azureappservice';
import { IActionContext, IAzureNode, IAzureTreeItem, IChildProvider, UserCancelledError } from 'vscode-azureextensionui';
import * as util from '../util';
import { WebAppTreeItem } from './WebAppTreeItem';

export class WebAppProvider implements IChildProvider {
    public readonly childTypeLabel: string = 'Web App';

    private _nextLink: string | undefined;

    public hasMoreChildren(): boolean {
        return this._nextLink !== undefined;
    }

    public async loadMoreChildren(node: IAzureNode, clearCache: boolean): Promise<IAzureTreeItem[]> {
        if (clearCache) {
            this._nextLink = undefined;
        }

        const client: WebSiteManagementClient = new WebSiteManagementClient(node.credentials, node.subscriptionId);
        const webAppCollection: WebAppCollection = this._nextLink === undefined ?
            await client.webApps.list() :
            await client.webApps.listNext(this._nextLink);

        this._nextLink = webAppCollection.nextLink;

        return await Promise.all(webAppCollection
            .map((s: Site) => new SiteClient(s, node))
            .filter((s: SiteClient) => !s.isFunctionApp)
            .map(async (s: SiteClient) => {
                const appServicePlan: AppServicePlan = await s.getAppServicePlan();
                return new WebAppTreeItem(s, appServicePlan);
            }));
    }

    public async createChild(node: IAzureNode<IAzureTreeItem>, showCreatingNode: (label: string) => void, actionContext: IActionContext): Promise<IAzureTreeItem> {
        const newSite: Site | undefined = await createWebApp(util.getOutputChannel(), node.ui, actionContext, node.credentials, node.subscriptionId, node.subscriptionDisplayName, showCreatingNode);
        if (newSite === undefined) {
            throw new UserCancelledError();
        } else {
            const siteClient: SiteClient = new SiteClient(newSite, node);
            const appServicePlan: AppServicePlan = await siteClient.getAppServicePlan();
            return new WebAppTreeItem(siteClient, appServicePlan);
        }
    }
}

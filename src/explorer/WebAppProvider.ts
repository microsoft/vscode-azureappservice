/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import WebSiteManagementClient = require('azure-arm-website');
import { AppServicePlan, Site, WebAppCollection } from 'azure-arm-website/lib/models';
import { workspace, WorkspaceConfiguration } from 'vscode';
import { createWebApp, SiteClient } from 'vscode-azureappservice';
import { IActionContext, IAzureNode, IAzureTreeItem, IChildProvider, UserCancelledError } from 'vscode-azureextensionui';
import { configurationSettings, extensionPrefix } from '../constants';
import * as util from '../util';
import { InvalidWebAppTreeItem } from './InvalidWebAppTreeItem';
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

        const treeItems: IAzureTreeItem[] = [];
        await Promise.all(webAppCollection
            .map(async (s: Site) => {
                try {
                    const siteClient: SiteClient = new SiteClient(s, node);
                    if (!siteClient.isFunctionApp) {
                        const appServicePlan: AppServicePlan = await siteClient.getAppServicePlan();
                        treeItems.push(new WebAppTreeItem(siteClient, appServicePlan));
                    }
                } catch {
                    if (s.name) {
                        treeItems.push(new InvalidWebAppTreeItem(s.name, 'Invalid'));
                    }
                }
            }));
        return treeItems;
    }

    public async createChild(node: IAzureNode<IAzureTreeItem>, showCreatingNode: (label: string) => void, actionContext: IActionContext): Promise<IAzureTreeItem> {
        const workspaceConfig: WorkspaceConfiguration = workspace.getConfiguration(extensionPrefix);
        const advancedCreation: boolean | undefined = workspaceConfig.get(configurationSettings.advancedCreation);
        const newSite: Site | undefined = await createWebApp(util.getOutputChannel(), node.ui, actionContext, node.credentials, node.subscriptionId, node.subscriptionDisplayName, showCreatingNode, advancedCreation);
        if (newSite === undefined) {
            throw new UserCancelledError();
        } else {
            const siteClient: SiteClient = new SiteClient(newSite, node);
            const appServicePlan: AppServicePlan = await siteClient.getAppServicePlan();
            return new WebAppTreeItem(siteClient, appServicePlan);
        }
    }
}

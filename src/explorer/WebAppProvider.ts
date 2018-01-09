/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppServicePlan, Site, WebAppCollection } from 'azure-arm-website/lib/models';
import { Memento } from 'vscode';
import { createWebApp } from 'vscode-azureappservice';
import { IAzureNode, IAzureTreeItem, IChildProvider, UserCancelledError } from 'vscode-azureextensionui';
import * as util from '../util';
import { nodeUtils } from '../utils/nodeUtils';
import { getAppServicePlan } from './SiteTreeItem';
import { WebAppTreeItem } from './WebAppTreeItem';

export class WebAppProvider implements IChildProvider {
    public readonly childTypeLabel: string = 'Web App';

    private _nextLink: string | undefined;
    private _globalState: Memento;

    public constructor(globalState: Memento) {
        this._globalState = globalState;
    }

    public hasMoreChildren(): boolean {
        return this._nextLink !== undefined;
    }

    public async loadMoreChildren(node: IAzureNode): Promise<IAzureTreeItem[]> {
        const webAppCollection: WebAppCollection = this._nextLink === undefined ?
            await nodeUtils.getWebSiteClient(node).webApps.list() :
            await nodeUtils.getWebSiteClient(node).webApps.listNext(this._nextLink);

        this._nextLink = webAppCollection.nextLink;

        return await Promise.all(webAppCollection
            .filter((site: Site) => site.kind !== 'functionapp')
            .map(async (site: Site) => {
                const appServicePlan: AppServicePlan = await getAppServicePlan(site, nodeUtils.getWebSiteClient(node));
                return new WebAppTreeItem(site, appServicePlan);
            }));
    }

    public async createChild(node: IAzureNode<IAzureTreeItem>, showCreatingNode: (label: string) => void): Promise<IAzureTreeItem> {
        const newSite: Site | undefined = await createWebApp(util.getOutputChannel(), this._globalState, node.credentials, node.subscription, showCreatingNode);
        if (newSite === undefined) {
            throw new UserCancelledError();
        } else {
            const appServicePlan: AppServicePlan = await getAppServicePlan(newSite, nodeUtils.getWebSiteClient(node));
            const newItem: WebAppTreeItem = new WebAppTreeItem(newSite, appServicePlan);
            newItem.browse();
            return newItem;
        }
    }
}

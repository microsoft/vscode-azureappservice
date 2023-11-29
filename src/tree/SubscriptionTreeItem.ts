/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient, type Site } from '@azure/arm-appservice';
import { ParsedSite } from '@microsoft/vscode-azext-azureappservice';
import { createAzureClient, SubscriptionTreeItemBase, uiUtils } from '@microsoft/vscode-azext-azureutils';
import { parseError, type AzExtTreeItem, type IActionContext } from '@microsoft/vscode-azext-utils';
import { localize } from '../localize';
import { SiteTreeItem } from './SiteTreeItem';

/**
 * Class is currently unused except for broken tests. TODO: fix tests with real solution.
 */
export class SubscriptionTreeItem extends SubscriptionTreeItemBase {
    public readonly childTypeLabel: string = localize('webApp', 'Web App');
    public supportsAdvancedCreation: boolean = true;

    private _nextLink: string | undefined;

    public hasMoreChildrenImpl(): boolean {
        return !!this._nextLink;
    }

    public async loadMoreChildrenImpl(clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]> {
        if (clearCache) {
            this._nextLink = undefined;
        }

        const client: WebSiteManagementClient = createAzureClient([context, this], WebSiteManagementClient);

        let webAppCollection: Site[];
        try {
            // Load more currently broken https://github.com/Azure/azure-sdk-for-js/issues/20380
            webAppCollection = await uiUtils.listAllIterator(client.webApps.list());
        } catch (error) {
            if (parseError(error).errorType.toLowerCase() === 'notfound') {
                // This error type means the 'Microsoft.Web' provider has not been registered in this subscription
                // In that case, we know there are no web apps, so we can return an empty array
                // (The provider will be registered automatically if the user creates a new web app)
                return [];
            } else {
                throw error;
            }
        }

        return await this.createTreeItemsWithErrorHandling(
            webAppCollection,
            'invalidAppService',
            s => {
                const site = new ParsedSite(s, this.subscription);
                return site.isFunctionApp ? undefined : new SiteTreeItem(this, site);
            },
            s => {
                return s.name;
            }
        );
    }
}

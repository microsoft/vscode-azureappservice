/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient } from 'azure-arm-website';
import { Site, WebAppCollection } from 'azure-arm-website/lib/models';
import { ConfigurationTarget, MessageItem, workspace, WorkspaceConfiguration } from 'vscode';
import { createWebApp, SiteClient } from 'vscode-azureappservice';
import { AzureTreeItem, createAzureClient, createTreeItemsWithErrorHandling, IActionContext, parseError, SubscriptionTreeItem, UserCancelledError } from 'vscode-azureextensionui';
import { configurationSettings, extensionPrefix } from '../constants';
import { ext } from '../extensionVariables';
import { WebAppTreeItem } from './WebAppTreeItem';

export class WebAppProvider extends SubscriptionTreeItem {
    public readonly childTypeLabel: string = 'Web App';

    private _nextLink: string | undefined;

    public hasMoreChildrenImpl(): boolean {
        return this._nextLink !== undefined;
    }

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<AzureTreeItem[]> {
        if (clearCache) {
            this._nextLink = undefined;
        }

        const client: WebSiteManagementClient = createAzureClient(this.root, WebSiteManagementClient);

        let webAppCollection: WebAppCollection;
        try {
            webAppCollection = this._nextLink === undefined ?
                await client.webApps.list() :
                await client.webApps.listNext(this._nextLink);
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

        this._nextLink = webAppCollection.nextLink;

        return await createTreeItemsWithErrorHandling(
            this,
            webAppCollection,
            'invalidAppService',
            (s: Site) => {
                const siteClient: SiteClient = new SiteClient(s, this.root);
                return siteClient.isFunctionApp ? undefined : new WebAppTreeItem(this, siteClient);
            },
            (s: Site) => {
                return s.name;
            }
        );
    }

    public async createChildImpl(showCreatingTreeItem: (label: string) => void, actionContext: IActionContext): Promise<AzureTreeItem> {
        const workspaceConfig: WorkspaceConfiguration = workspace.getConfiguration(extensionPrefix);
        const advancedCreation: boolean | undefined = workspaceConfig.get(configurationSettings.advancedCreation);
        let newSite: Site | undefined;
        try {
            newSite = await createWebApp(actionContext, this.root, { advancedCreation }, showCreatingTreeItem);
        } catch (error) {
            if (!parseError(error).isUserCancelledError && !advancedCreation) {
                const message: string = `Modify the setting "${extensionPrefix}.${configurationSettings.advancedCreation}" if you want to change the default values when creating a Web App in Azure.`;
                const btn: MessageItem = { title: 'Turn on advanced creation' };
                // tslint:disable-next-line: no-floating-promises
                ext.ui.showWarningMessage(message, btn).then(async result => {
                    if (result === btn) {
                        const projectConfiguration: WorkspaceConfiguration = workspace.getConfiguration('appService');
                        await projectConfiguration.update('advancedCreation', true, ConfigurationTarget.Global);
                    }
                });
            }
            throw error;
        }
        if (newSite === undefined) {
            throw new UserCancelledError();
        } else {
            const siteClient: SiteClient = new SiteClient(newSite, this.root);
            return new WebAppTreeItem(this, siteClient);
        }
    }
}

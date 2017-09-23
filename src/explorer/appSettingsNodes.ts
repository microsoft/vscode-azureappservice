/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WebSiteModels from '../../node_modules/azure-arm-website/lib/models';
import * as opn from 'opn';
import * as path from 'path';
import { AzureAccountWrapper } from '../azureAccountWrapper';
import { NodeBase } from './nodeBase';
import { AppServiceDataProvider } from './appServiceExplorer';
import { SubscriptionClient, SubscriptionModels } from 'azure-arm-resource';
import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter, Event, OutputChannel } from 'vscode';
import WebSiteManagementClient = require('azure-arm-website');

export class AppSettingsNode extends NodeBase {
    private _settings: WebSiteModels.StringDictionary;
    private _isSlot: boolean;
    private _siteName: string;
    private _slotName: string;
    private _websiteClient: WebSiteManagementClient;
    
    constructor(readonly site: WebSiteModels.Site, 
        readonly subscription: SubscriptionModels.Subscription, 
        treeDataProvider: AppServiceDataProvider,
        parentNode: NodeBase) {
        super('Application Settings', treeDataProvider, parentNode);
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
            contextValue: "applicationSettings",
            iconPath: { 
                light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'Settings_16x_vscode.svg'),
                dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'Settings_16x_vscode.svg')
            }
        }
    }

    async getChildren(): Promise<NodeBase[]> {
        this._isSlot = this.site.type.toLowerCase() === 'microsoft.web/sites/slots';
        this._siteName = this._isSlot ? this.site.name.substring(0, this.site.name.lastIndexOf('/')) : this.site.name;
        this._slotName = this._isSlot ? this.site.name.substring(this.site.name.lastIndexOf('/') + 1) : undefined;

        return [];
    }

    protected get WebSiteManagementClient(): WebSiteManagementClient {
        if (!this._websiteClient) {
            this._websiteClient = new WebSiteManagementClient(
                this.azureAccount.getCredentialByTenantId(this.subscription.tenantId),
                this.subscription.subscriptionId);
        }
        return this._websiteClient;
    }

    get azureAccount(): AzureAccountWrapper {
        return this.getTreeDataProvider<AppServiceDataProvider>().azureAccount;
    }
}

class AppSettingNode extends NodeBase {

}
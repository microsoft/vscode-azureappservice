/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WebSiteModels from '../../node_modules/azure-arm-website/lib/models';
import * as opn from 'opn';
import * as path from 'path';
import * as vscode from 'vscode';
import { AzureAccountWrapper } from '../azureAccountWrapper';
import { NodeBase } from './nodeBase';
import { AppServiceDataProvider } from './appServiceExplorer';
import { SubscriptionClient, SubscriptionModels } from 'azure-arm-resource';
import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter, Event, OutputChannel } from 'vscode';
import WebSiteManagementClient = require('azure-arm-website');

export class AppSettingsNode extends NodeBase {
    private _settings: WebSiteModels.StringDictionary;
    readonly _isSlot: boolean;
    readonly _siteName: string;
    readonly _slotName: string;
    readonly _websiteClient: WebSiteManagementClient;
    
    constructor(readonly site: WebSiteModels.Site, 
        readonly subscription: SubscriptionModels.Subscription, 
        treeDataProvider: AppServiceDataProvider,
        parentNode: NodeBase) {
        super('Application Settings', treeDataProvider, parentNode);
        this._isSlot = this.site.type.toLowerCase() === 'microsoft.web/sites/slots';
        this._siteName = this._isSlot ? this.site.name.substring(0, this.site.name.lastIndexOf('/')) : this.site.name;
        this._slotName = this._isSlot ? this.site.name.substring(this.site.name.lastIndexOf('/') + 1) : undefined;
        this._websiteClient = new WebSiteManagementClient(
            this.azureAccount.getCredentialByTenantId(this.subscription.tenantId),
            this.subscription.subscriptionId);
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
        this._settings = await this.getSettings();
        return this.generateTreeItems(this._settings);
    }

    async editSettingItem(oldKey: string, newKey: string, value: string): Promise<void> {
        if (this._settings.properties) {
            if (oldKey !== newKey) {
                delete this._settings.properties[oldKey];
            }
            this._settings.properties[newKey] = value;
        }
        await this.applySettings();
    }

    async deleteSettingItem(key: string): Promise<void> {
        if (this._settings.properties) {
            delete this._settings.properties[key];
        }
        await this.applySettings();
    }

    async addSettingItem(): Promise<void> {
        const newKey = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            prompt: 'Enter new setting key',
            validateInput: v => this.validateNewKeyInput(v)
        });

        if (!newKey) {
            return;
        }

        const newValue = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            prompt: `Enter setting value for "${newKey}"`,
        }) || '';

        if (!this._settings.properties) {
            this._settings.properties = {};
        }

        this._settings.properties[newKey] = newValue;

        await this.applySettings();
        this.getTreeDataProvider<AppServiceDataProvider>().refresh(this);
    }

    validateNewKeyInput(newKey: string, oldKey?: string): string {
        if (!newKey || newKey.trim().length === 0) {
            return 'Key must have at least one non-whitespace character.'; 
        }

        if (this._settings.properties && this._settings.properties[newKey] && newKey !== oldKey) {
            return `Setting "${newKey}" already exists.`; 
        }
    }

    protected get WebSiteManagementClient(): WebSiteManagementClient {
        return this._websiteClient;
    }

    private get azureAccount(): AzureAccountWrapper {
        return this.getTreeDataProvider<AppServiceDataProvider>().azureAccount;
    }

    private getSettings(): Promise<WebSiteModels.StringDictionary> {
        const webApps = this.WebSiteManagementClient.webApps;
        return this._isSlot ? webApps.listApplicationSettingsSlot(this.site.resourceGroup, this._siteName, this._slotName) : 
            webApps.listApplicationSettings(this.site.resourceGroup, this._siteName);
    }

    private applySettings(): Promise<WebSiteModels.StringDictionary> {
        const webApps = this.WebSiteManagementClient.webApps;
        const updateTask = this._isSlot ? webApps.updateApplicationSettingsSlot(this.site.resourceGroup, this._siteName, this._settings, this._slotName) :
            webApps.updateApplicationSettings(this.site.resourceGroup, this._siteName, this._settings);
        return updateTask;
    }

    private generateTreeItems(settings: WebSiteModels.StringDictionary): AppSettingNode[] {
        const children: AppSettingNode[] = [];

        if (settings.properties) {
            for (let key in settings.properties) {
                children.push(new AppSettingNode(
                    key,
                    settings.properties[key],
                    this.getTreeDataProvider(),
                    this
                ));
            }
        }

        return children.sort((a, b) => a.label.localeCompare(b.label));
    }
}

export class AppSettingNode extends NodeBase {
    constructor(private key: string,
        private value: string,
        treeDataProvider: AppServiceDataProvider,
        parentNode: NodeBase) {
        super(`${key} : ${value}`, treeDataProvider, parentNode);
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.None,
            contextValue: "applicationSettingItem",
            iconPath: { 
                light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'Item_16x_vscode.svg'),
                dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'Item_16x_vscode.svg')
            }
        }
    }

    async edit(): Promise<void> {
        const oldKey = this.key;
        const newKey = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            prompt: 'Enter setting key',
            value: this.key,
            validateInput: v => (<AppSettingsNode>this.getParentNode()).validateNewKeyInput(v, oldKey)
        });

        if (!newKey) {
            return;
        }

        const newValue = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            prompt: `Enter setting value for "${newKey}"`,
            value: this.value
        }) || '';

        this.key = newKey;
        this.value = newValue;
        this.label = `${this.key} : ${this.value}`;

        await (<AppSettingsNode>this.getParentNode()).editSettingItem(oldKey, newKey, newValue);

        // Ideally we only need to refresh the current item, but because of this https://github.com/Microsoft/vscode/issues/34789,
        // have to use workaround for now.
        // this.getTreeDataProvider<AppServiceDataProvider>().refresh(this);
        this.getTreeDataProvider<AppServiceDataProvider>().refresh(this.getParentNode());
    }

    async delete(): Promise<void> {
        const okayAction = "Delete";
        const result = await vscode.window.showWarningMessage(`Are you sure you want to delete setting "${this.key}"?`, okayAction);

        if (result === okayAction) {
            await (<AppSettingsNode>this.getParentNode()).deleteSettingItem(this.key);
            this.getTreeDataProvider<AppServiceDataProvider>().refresh(this.getParentNode());
        }
    }
}

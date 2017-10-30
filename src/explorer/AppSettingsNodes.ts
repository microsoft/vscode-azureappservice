/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SubscriptionModels } from 'azure-arm-resource';
import WebSiteManagementClient = require('azure-arm-website');
import * as opn from 'opn';
import * as path from 'path';
import * as vscode from 'vscode';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import * as WebSiteModels from '../../node_modules/azure-arm-website/lib/models';
import { AzureAccountWrapper } from '../AzureAccountWrapper';
import * as util from '../util';
import { AppServiceDataProvider } from './AppServiceExplorer';
import { NodeBase } from './NodeBase';

export class AppSettingsNode extends NodeBase {
    private readonly _site: WebSiteModels.Site;
    private readonly _subscription: SubscriptionModels.Subscription;
    private readonly _isSlot: boolean;
    private readonly _siteName: string;
    private readonly _slotName: string;
    private readonly _websiteClient: WebSiteManagementClient;
    private _settings: WebSiteModels.StringDictionary;

    public get site(): WebSiteModels.Site {
        return this._site;
    }

    public get subscription(): SubscriptionModels.Subscription {
        return this._subscription;
    }

    constructor(
        site: WebSiteModels.Site,
        subscription: SubscriptionModels.Subscription,
        treeDataProvider: AppServiceDataProvider,
        parentNode: NodeBase) {
        super('Application Settings', treeDataProvider, parentNode);
        this._site = site;
        this._subscription = subscription;
        this._isSlot = util.isSiteDeploymentSlot(site);
        this._siteName = util.extractSiteName(site);
        this._slotName = util.extractDeploymentSlotName(site);
        this._websiteClient = new WebSiteManagementClient(
            this.azureAccount.getCredentialByTenantId(this.subscription.tenantId),
            this.subscription.subscriptionId);
    }

    public getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
            contextValue: 'applicationSettings',
            iconPath: {
                light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'AppSettings_color.svg'),
                dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'AppSettings_color.svg')
            }
        };
    }

    public async getChildren(): Promise<NodeBase[]> {
        const webApps = this.WebSiteManagementClient.webApps;
        const children: AppSettingNode[] = [];
        this._settings = this._isSlot ? await webApps.listApplicationSettingsSlot(this.site.resourceGroup, this._siteName, this._slotName) :
            await webApps.listApplicationSettings(this.site.resourceGroup, this._siteName);

        if (this._settings.properties) {
            Object.keys(this._settings.properties).forEach((key: string) => {
                children.push(new AppSettingNode(
                    key,
                    this._settings.properties[key],
                    this.getTreeDataProvider(),
                    this
                ));
            });
        }

        return children.sort((a, b) => a.label.localeCompare(b.label));
    }

    public async editSettingItem(oldKey: string, newKey: string, value: string): Promise<void> {
        if (this._settings.properties) {
            if (oldKey !== newKey) {
                delete this._settings.properties[oldKey];
            }
            this._settings.properties[newKey] = value;
        }
        await this.applySettings();
    }

    public async deleteSettingItem(key: string): Promise<void> {
        if (this._settings.properties) {
            delete this._settings.properties[key];
        }
        await this.applySettings();
    }

    public async addSettingItem(): Promise<void> {
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
            prompt: `Enter setting value for "${newKey}"`
        }) || '';

        if (!this._settings.properties) {
            this._settings.properties = {};
        }

        this._settings.properties[newKey] = newValue;

        await this.applySettings();
        this.getTreeDataProvider<AppServiceDataProvider>().refresh(this);
    }

    public validateNewKeyInput(newKey: string, oldKey?: string): string | undefined {
        newKey = newKey ? newKey.trim() : '';
        oldKey = oldKey ? oldKey.trim().toLowerCase() : oldKey;
        if (newKey.length === 0) {
            return 'Key must have at least one non-whitespace character.';
        }

        if (this._settings.properties && newKey.toLowerCase() !== oldKey) {
            for (const key in this._settings.properties) {
                if (key.toLowerCase() === newKey.toLowerCase()) {
                    return `Setting "${newKey}" already exists.`;
                }
            }
        }

        return undefined;
    }

    public openInPortal(): void {
        const portalEndpoint = 'https://portal.azure.com';
        const deepLink = `${portalEndpoint}/${this.subscription.tenantId}/#resource${this.site.id}/application`;
        opn(deepLink);
    }

    protected get WebSiteManagementClient(): WebSiteManagementClient {
        return this._websiteClient;
    }

    private get azureAccount(): AzureAccountWrapper {
        return this.getTreeDataProvider<AppServiceDataProvider>().azureAccount;
    }

    private applySettings(): Promise<WebSiteModels.StringDictionary> {
        const webApps = this.WebSiteManagementClient.webApps;
        return this._isSlot ? webApps.updateApplicationSettingsSlot(this.site.resourceGroup, this._siteName, this._settings, this._slotName) :
            webApps.updateApplicationSettings(this.site.resourceGroup, this._siteName, this._settings);
    }
}

export class AppSettingNode extends NodeBase {
    private key: string;
    private value: string;

    constructor(
        key: string,
        value: string,
        treeDataProvider: AppServiceDataProvider,
        parentNode: NodeBase) {
        super(`${key}=${value}`, treeDataProvider, parentNode);
        this.key = key;
        this.value = value;
    }

    public getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.None,
            contextValue: 'applicationSettingItem',
            iconPath: {
                light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'Item_16x_vscode.svg'),
                dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'Item_16x_vscode.svg')
            }
        };
    }

    public async edit(): Promise<void> {
        const newValue = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            prompt: `Enter setting value for "${this.key}"`,
            value: this.value
        });

        if (newValue === undefined) {
            return;
        }

        this.value = newValue;
        await this.getParentNode<AppSettingsNode>().editSettingItem(this.key, this.key, newValue);
        this.refresh();
    }

    public async rename(): Promise<void> {
        const oldKey = this.key;
        const newKey = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            prompt: `Enter a new name for "${oldKey}"`,
            value: this.key,
            validateInput: v => this.getParentNode<AppSettingsNode>().validateNewKeyInput(v, oldKey)
        });

        if (!newKey) {
            return;
        }

        this.key = newKey;
        await this.getParentNode<AppSettingsNode>().editSettingItem(oldKey, newKey, this.value);
        this.refresh();
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async delete(): Promise<void> {
        const okayAction = 'Delete';
        const result = await vscode.window.showWarningMessage(`Are you sure you want to delete setting "${this.key}"?`, okayAction);

        if (result === okayAction) {
            await this.getParentNode<AppSettingsNode>().deleteSettingItem(this.key);
            this.getTreeDataProvider<AppServiceDataProvider>().refresh(this.getParentNode());
        }
    }

    public refresh(): void {
        this.label = `${this.key}=${this.value}`;
        // Ideally we only need to refresh the current item, but because of this https://github.com/Microsoft/vscode/issues/34789,
        // have to use workaround for now.
        // this.getTreeDataProvider<AppServiceDataProvider>().refresh(this);
        this.getTreeDataProvider<AppServiceDataProvider>().refresh(this.getParentNode());
    }
}

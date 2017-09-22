/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureAccountWrapper } from './azureAccountWrapper';
import { SubscriptionModels } from 'azure-arm-resource';
import { WizardBase, WizardResult, WizardStep, SubscriptionStepBase, UserCancelledError, QuickPickItemWithData } from './wizard';
import * as util from './util';
import * as vscode from 'vscode';
import WebSiteManagementClient = require('azure-arm-website');
import * as WebSiteModels from '../node_modules/azure-arm-website/lib/models';

export class WebAppSettingsEditor extends WizardBase {
    constructor(output: vscode.OutputChannel, 
        azureAccount: AzureAccountWrapper, 
        subscription: SubscriptionModels.Subscription,
        site: WebSiteModels.Site) {
        super(output);

        this.steps.push(new EditStep(this, azureAccount, subscription, site));
    }
}

class EditStep extends SubscriptionStepBase {
    private readonly _isSlot: boolean;
    private readonly _siteName: string;
    private readonly _slotName: string;
    private readonly _websiteClient: WebSiteManagementClient;
    private _isDirty = false;
    private _appSettings: WebSiteModels.StringDictionary;
    private _applySettingsItem: QuickPickItemWithData<{key: string, value: string}> = {
        label: '️️️️✔️ Apply changes',
        description: null,
        data: null
    };
    private _addNewItem: QuickPickItemWithData<{key: string, value: string}> = {
        label: '✏️ Add setting',
        description: null,
        data: null
    };
    private _deleteItem: QuickPickItemWithData<{key: string, value: string}> = {
        label: '❌ Delete setting',
        description: null,
        data: null
    };

    constructor(wizard: WizardBase,
        azureAccount: AzureAccountWrapper,
        subscription: SubscriptionModels.Subscription,
        readonly site: WebSiteModels.Site) {
        super(wizard, 'Edit Application Settings', azureAccount, subscription);

        this._isSlot = site.type.toLowerCase() === 'microsoft.web/sites/slots';
        this._siteName = this._isSlot ? site.name.substring(0, site.name.lastIndexOf('/')) : site.name;
        this._slotName = this._isSlot ? site.name.substring(site.name.lastIndexOf('/') + 1) : undefined;
        this._websiteClient = new WebSiteManagementClient(azureAccount.getCredentialByTenantId(subscription.tenantId), subscription.subscriptionId);
    }

    async prompt(): Promise<void> {
        let pickedItem: QuickPickItemWithData<{key: string, value: string}>;

        while (pickedItem !== this._applySettingsItem) {
            pickedItem = await this.showQuickPick(this.GenerateMainQuickPickItems(), { placeHolder: 'Select a setting to edit its value. Press ESC to discard all changes.' });

            if (pickedItem === this._addNewItem) {
                this._isDirty = await this.AddNewSetting() || this._isDirty;
            } else if (pickedItem === this._deleteItem) {
                this._isDirty = await this.DeleteSetting() || this._isDirty;
            } else if (pickedItem !== this._applySettingsItem) {
                this._isDirty = await this.EditSetting(pickedItem.data.key, pickedItem.data.value) || this._isDirty;
            }
        }
    }

    async execute(): Promise<void> {
        if (this._isDirty) {
            const updateSettingsTask = !this._isSlot ? this.WebSiteManagementClient.webApps.updateApplicationSettings(this.site.resourceGroup, this._siteName, this._appSettings) :
                this.WebSiteManagementClient.webApps.updateApplicationSettingsSlot(this.site.resourceGroup, this._siteName, this._appSettings, this._slotName);

            this.wizard.writeline('Updating Application Settings...');
            await updateSettingsTask;
            this.wizard.writeline('Application Settings updated!');
        }
    }

    private async AddNewSetting(): Promise<boolean> {
        try {        
            const newKey = await this.showInputBox({
                prompt: 'Name of the new setting',
                placeHolder: 'key',
                validateInput: v => {
                    if (!v || v.trim().length === 0) {
                        return 'Key must have at least one non-whitespace character.';
                    }

                    if (this._appSettings.properties && this._appSettings.properties[v]) {
                        return `Setting "${v}" already exists.`;
                    }
                }
            });
            const newValue = await this.showInputBox({
                prompt: `Value of "${newKey}"`,
                placeHolder: 'value',
                validateInput: v => v && v.length > 0 ? null : 'Value must have at least one character.'
            });

            if (!this._appSettings.properties) {
                this._appSettings.properties = {};
            }

            this._appSettings.properties[newKey] = newValue;
        } catch (err) {
            if (err instanceof UserCancelledError) {
                return false;
            }

            throw err;
        }
        return true;
    }

    private async DeleteSetting(): Promise<boolean> {
        try {
            const quickPickItems: QuickPickItemWithData<{key: string, value: string}>[] = [];
            this.AppSettingsToQuickPickItems(this._appSettings, quickPickItems);
            const result = await this.showQuickPick(quickPickItems, { placeHolder: 'Select the setting you want to delete.'});
            delete this._appSettings.properties[result.data.key];
        } catch (err) {
            if (err instanceof UserCancelledError) {
                return false;
            }

            throw err;
        }
        return true;
    }

    private async EditSetting(key: string, value: string): Promise<boolean> {
        try {
            const newValue = await this.showInputBox({
                prompt: `Value of "${key}"`,
                value: value,
                validateInput: v => v && v.length > 0 ? null : 'Value must have at least one character.'
            });
            this._appSettings.properties[key] = newValue;
        } catch (err) {
            if (err instanceof UserCancelledError) {
                return false;
            }

            throw err;
        }
        return true;
    }

    private GenerateMainQuickPickItems(): Promise<QuickPickItemWithData<{key: string, value: string}>[]> {
        let settingsTask: Promise<WebSiteModels.StringDictionary>;

        if (!this._appSettings) {
            settingsTask = this._isSlot ? this.WebSiteManagementClient.webApps.listApplicationSettingsSlot(this.site.resourceGroup, this._siteName, this._slotName) :
                this.WebSiteManagementClient.webApps.listApplicationSettings(this.site.resourceGroup, this._siteName);
        } else {
            settingsTask = Promise.resolve(this._appSettings);
        }

        return settingsTask.then(result => {
            const quickPickList: QuickPickItemWithData<{key: string, value: string}>[] = [this._applySettingsItem, this._addNewItem, this._deleteItem];
            this._appSettings = result;
            this.AppSettingsToQuickPickItems(this._appSettings, quickPickList);
            return quickPickList;
        });
    }

    private AppSettingsToQuickPickItems(settings: WebSiteModels.StringDictionary, quickPickItems: QuickPickItemWithData<{key: string, value: string}>[]) {
        if (settings.properties) {
            for (let key in settings.properties) {
                quickPickItems.push({
                    label: key,
                    description: settings.properties[key],
                    data: {
                        key: key,
                        value: settings.properties[key]
                    }
                });
            }
        }
    }
    
    protected get WebSiteManagementClient(): WebSiteManagementClient {
        return this._websiteClient;
    }
}

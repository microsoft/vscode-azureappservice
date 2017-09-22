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
            pickedItem = await this.showQuickPick(this.GenerateMainQuickPickItems(), { placeHolder: 'Select a setting to edit its value.' });

            if (pickedItem === this._addNewItem) {

            } else if (pickedItem === this._deleteItem) {

            } else {
                
            }
        }
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

            if (this._appSettings.properties) {
                for (let key in this._appSettings.properties) {
                    quickPickList.push({
                        label: key,
                        description: this._appSettings.properties[key],
                        data: {
                            key: key,
                            value: this._appSettings.properties[key]
                        }
                    });
                }
            }

            return quickPickList;
        });
    }
    
    protected get WebSiteManagementClient(): WebSiteManagementClient {
        return this._websiteClient;
    }
}